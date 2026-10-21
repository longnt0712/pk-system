# Exercise the production archive inspection without accessing any server.
$ErrorActionPreference = 'Stop'
$productionDirectory = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$productionSource = Get-Content -LiteralPath (Join-Path $productionDirectory 'Test-Backend.ps1') -Raw
$fixtureDirectory = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) ('pk-system-library-check-' + [Guid]::NewGuid().ToString('N'))))
New-Item -ItemType Directory -Path $fixtureDirectory | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$shim = @'
$ErrorActionPreference = 'Stop'
function Get-NetTCPConnection { return [pscustomobject]@{OwningProcess=3616} }
function Get-CimInstance { return [pscustomobject]@{ExecutablePath='fixture-java.exe';CommandLine='java -jar richy-wine-exec.jar'} }
function Get-Process { return [pscustomobject]@{StartTime=(Get-Date).AddHours(-2);WorkingSet64=104857600;Threads=@(1,2)} }
function Invoke-WebRequest { return [pscustomobject]@{StatusCode=401;Content=''} }
function Start-Service { throw 'Diagnostics must not start services.' }
function Stop-Service { throw 'Diagnostics must not stop services.' }
function Stop-Process { throw 'Diagnostics must not stop processes.' }
'@

function Add-NestedLibrary($Archive, [string]$Name, [string[]]$Classes) {
    $buffer = New-Object IO.MemoryStream
    $nested = New-Object IO.Compression.ZipArchive($buffer, [IO.Compression.ZipArchiveMode]::Create, $true)
    try { foreach ($class in $Classes) { $nested.CreateEntry($class) | Out-Null } }
    finally { $nested.Dispose() }
    $entry = $Archive.CreateEntry('BOOT-INF/lib/' + $Name)
    $stream = $entry.Open()
    try { $buffer.Position = 0; $buffer.CopyTo($stream) }
    finally { $stream.Dispose(); $buffer.Dispose() }
}

try {
    foreach ($scenario in @('complete', 'missing-class', 'missing-library')) {
        $caseDirectory = Join-Path $fixtureDirectory $scenario
        New-Item -ItemType Directory -Path $caseDirectory | Out-Null
        $jarPath = Join-Path $caseDirectory 'richy-wine-exec.jar'
        $archive = [IO.Compression.ZipFile]::Open($jarPath, [IO.Compression.ZipArchiveMode]::Create)
        try {
            if ($scenario -ne 'missing-library') {
                $springClasses = @('fixture/Marker.class')
                if ($scenario -ne 'missing-class') { $springClasses += 'org/springframework/web/multipart/support/StandardMultipartHttpServletRequest.class' }
                Add-NestedLibrary $archive 'spring-web-4.3.9.RELEASE.jar' $springClasses
            }
            Add-NestedLibrary $archive 'hibernate-core-5.0.12.Final.jar' @('org/hibernate/event/spi/ClearEvent.class', 'org/hibernate/type/descriptor/sql/NClobTypeDescriptor$1.class')
            Add-NestedLibrary $archive 'logback-classic-1.1.11.jar' @('ch/qos/logback/classic/spi/ThrowableProxy.class')
        } finally { $archive.Dispose() }
        $scriptPath = Join-Path $caseDirectory 'Test-Backend.ps1'
        Set-Content -LiteralPath $scriptPath -Value $productionSource.Replace('$ErrorActionPreference = ''Stop''', $shim) -Encoding UTF8
        $reportPath = Join-Path $caseDirectory 'backend-check.txt'
        $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -JarPath $jarPath -ReportPath $reportPath 2>&1
        if ($LASTEXITCODE -ne 0) { throw ('Diagnostics failed: ' + ($output -join "`n")) }
        $report = Get-Content -LiteralPath $reportPath -Raw
        if ($report -match 'JAR inspection failed') { throw $report }
        foreach ($expected in @('Hibernate ClearEvent present: True', 'Hibernate NClobTypeDescriptor$1 present: True', 'ThrowableProxy present: True', 'JAR MODIFIED AFTER PROCESS START')) {
            if (-not $report.Contains($expected)) { throw ('Missing report line: ' + $expected) }
        }
        $springExpected = switch ($scenario) {
            'complete' { 'StandardMultipartHttpServletRequest present: True' }
            'missing-class' { 'StandardMultipartHttpServletRequest present: False' }
            'missing-library' { 'Required library NOT FOUND: spring-web' }
        }
        if (-not $report.Contains($springExpected)) { throw ('Missing report line: ' + $springExpected) }
        Write-Output ('PASS: ' + $scenario)
    }
} finally {
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $fixtureDirectory.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path -Leaf $fixtureDirectory) -notmatch '^pk-system-library-check-[0-9a-f]{32}$') {
        throw 'Refusing to clean an unexpected fixture directory.'
    }
    Remove-Item -LiteralPath $fixtureDirectory -Recurse -Force
}
