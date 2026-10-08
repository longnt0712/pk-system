# Exercise the actual restart script with simulated Windows process/service boundaries.
# No real process or service is stopped, started or inspected.
$ErrorActionPreference = 'Stop'
$productionPath = Join-Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)) 'Restart-Backend.ps1'
$productionSource = Get-Content -LiteralPath $productionPath -Raw
$fixtureDirectory = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) ('pk-system-restart-' + [Guid]::NewGuid().ToString('N'))))
New-Item -ItemType Directory -Path $fixtureDirectory | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$shim = @'
$ErrorActionPreference = 'Stop'
$scenarioDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$actionsPath = Join-Path $scenarioDirectory 'actions.txt'
Set-Content -LiteralPath $actionsPath -Value '' -Encoding UTF8
$script:listenerOwner = 320
$script:fixtureServiceState = 'Stopped'
function Get-NetTCPConnection {
    if ($script:listenerOwner) { return [pscustomobject]@{OwningProcess=$script:listenerOwner} }
    return @()
}
function Get-CimInstance {
    param([string]$ClassName, [string]$Filter)
    if ($ClassName -eq 'Win32_Process' -and $Filter -eq 'ProcessId=320') {
        $javaPath = 'C:\Program Files (x86)\Java\jre1.8.0_321\bin\java.exe'
        $commandLine = '"C:\Program Files (x86)\Java\jre1.8.0_321\bin\java" -Xms256m -Xmx896m -jar richy-wine-exec.jar --server.port=8085'
        if ('__SCENARIO__' -eq 'reject-command') { $commandLine = '"C:\other\java.exe" -jar richy-wine-exec.jar' }
        return [pscustomobject]@{Name='java.exe';ExecutablePath=$javaPath;CommandLine=$commandLine;ParentProcessId=4708}
    }
    if ($ClassName -eq 'Win32_Process' -and $Filter -eq 'ProcessId=4708') {
        return [pscustomobject]@{Name='richy-wine-service.exe'}
    }
    if ($ClassName -eq 'Win32_Service' -and $Filter -eq "Name='richy-wine-service'") {
        return [pscustomobject]@{Name='richy-wine-service';State=$script:fixtureServiceState;PathName=(Join-Path $scenarioDirectory 'richy-wine-service.exe')}
    }
    return @()
}
function Get-Process { return [pscustomobject]@{StartTime=[DateTime]'2026-10-08T07:00:04'} }
function Stop-Process {
    param([int]$Id, [switch]$Force)
    if ($Id -ne 320) { throw 'Attempt to stop an unrelated process.' }
    Add-Content -LiteralPath $actionsPath -Value ('STOP:' + $Id)
    $script:listenerOwner = 0
}
function Wait-Process {}
function Start-Service {
    param([string]$Name)
    if ($Name -ne 'richy-wine-service' -or $script:listenerOwner) { throw 'Service started before the correct port was clear.' }
    Add-Content -LiteralPath $actionsPath -Value ('START:' + $Name)
    $script:listenerOwner = 333
    $script:fixtureServiceState = 'Running'
}
function Restart-Service { throw 'A stopped service with an orphan must be recovered explicitly.' }
function Start-Process { throw 'An unmanaged Java copy must not be launched for the stopped service.' }
'@
try {
    foreach ($scenario in @('recover', 'check-only', 'reject-command')) {
        $caseDirectory = Join-Path $fixtureDirectory $scenario
        New-Item -ItemType Directory -Path $caseDirectory | Out-Null
        $jarPath = Join-Path $caseDirectory 'richy-wine-exec.jar'
        $archive = [IO.Compression.ZipFile]::Open($jarPath, [IO.Compression.ZipArchiveMode]::Create)
        try {
            $archive.CreateEntry('org/springframework/boot/loader/JarLauncher.class') | Out-Null
            $archive.CreateEntry('BOOT-INF/classes/com/globits/richy/RichyApplication.class') | Out-Null
        } finally { $archive.Dispose() }
        Set-Content -LiteralPath (Join-Path $caseDirectory 'richy-wine-service.exe') -Value 'fixture only' -Encoding ASCII
        $source = $productionSource.Replace('$ErrorActionPreference = ''Stop''', $shim.Replace('__SCENARIO__', $scenario))
        # Skip only the host administrator check inside the isolated fixture.
        $source = $source.Replace('if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {', 'if ($false) {')
        $scriptPath = Join-Path $caseDirectory 'Restart-Backend.ps1'
        Set-Content -LiteralPath $scriptPath -Value $source -Encoding UTF8
        $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $scriptPath,
            '-JarPath', $jarPath, '-ExpectedComputer', $env:COMPUTERNAME)
        if ($scenario -eq 'check-only') { $arguments += '-CheckOnly' }
        $testErrorPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $output = & powershell.exe @arguments 2>&1
            $exitCode = $LASTEXITCODE
        } finally { $ErrorActionPreference = $testErrorPreference }
        $actions = @(Get-Content -LiteralPath (Join-Path $caseDirectory 'actions.txt') | Where-Object { $_ })
        if ($scenario -eq 'recover') {
            if ($exitCode -ne 0 -or ($actions -join ',') -ne 'STOP:320,START:richy-wine-service' -or
                ($output -join "`n") -notmatch 'Confirmed listener PID: 333') {
                throw ('Recovery failed: ' + ($output -join "`n"))
            }
        } elseif ($scenario -eq 'check-only') {
            if ($exitCode -ne 0 -or $actions.Count -ne 0) { throw 'CheckOnly changed process/service state.' }
        } elseif ($exitCode -eq 0 -or $actions.Count -ne 0) { throw 'An unrelated Java command was not rejected before mutation.' }
        Write-Output ('PASS: ' + $scenario)
    }
} finally {
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $fixtureDirectory.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path -Leaf $fixtureDirectory) -notmatch '^pk-system-restart-[0-9a-f]{32}$') {
        throw 'Refusing to clean an unexpected fixture directory.'
    }
    Remove-Item -LiteralPath $fixtureDirectory -Recurse -Force
}
