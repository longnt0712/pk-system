[CmdletBinding()]
param(
    [ValidateRange(1, 65535)][int]$Port = 8085,
    [string]$SiteUrl = 'https://ieltsroom.com',
    [string]$JarPath = '',
    [string]$ReportPath = (Join-Path (Get-Location).Path 'backend-check.txt')
)

# Read-only diagnostics. No process, service, database or deployment is changed.
$ErrorActionPreference = 'Stop'
$reportLines = New-Object 'System.Collections.Generic.List[string]'
$backendProcess = $null
$backendStartUtc = $null

function Add-Report([string]$Line) {
    $reportLines.Add($Line)
    Write-Output $Line
}

function Test-Endpoint([string]$Label, [string]$Url) {
    $timer = [Diagnostics.Stopwatch]::StartNew()
    try {
        $reply = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8
        Add-Report ("{0}: HTTP {1}; {2:N1}s" -f $Label, [int]$reply.StatusCode, $timer.Elapsed.TotalSeconds)
        if ($Label -eq 'Public frontend' -and $reply.Content -match "APP_VERSION\s*=\s*'([^']+)'") {
            Add-Report ('Frontend version: ' + $Matches[1])
        }
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            Add-Report ("{0}: HTTP {1}; {2:N1}s (an HTTP error confirms the server responded)" -f
                $Label, [int]$_.Exception.Response.StatusCode, $timer.Elapsed.TotalSeconds)
        } else {
            Add-Report ("{0}: NO HTTP RESPONSE; {1:N1}s; {2}" -f
                $Label, $timer.Elapsed.TotalSeconds, $_.Exception.Message)
        }
    }
}

try {
    Add-Report ('Backend check UTC: ' + [DateTime]::UtcNow.ToString('o'))
    Add-Report ('Computer: ' + $env:COMPUTERNAME)
    Add-Report ('Backend port: ' + $Port)
    try {
        $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
        $backendIds = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
        if ($backendIds.Count -eq 0) {
            Add-Report 'No listening process found on the backend port.'
        }
        foreach ($backendId in $backendIds) {
            $backendProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $backendId)
            $runtimeProcess = Get-Process -Id $backendId
            $backendStartUtc = $runtimeProcess.StartTime.ToUniversalTime()
            Add-Report ('Listener PID: ' + $backendId + '; executable: ' + $backendProcess.ExecutablePath)
            Add-Report ('Process started UTC: ' + $backendStartUtc.ToString('o'))
            Add-Report ('Memory MB: ' + [Math]::Round($runtimeProcess.WorkingSet64 / 1MB, 1) +
                '; threads: ' + $runtimeProcess.Threads.Count)
            # Show only the JAR argument. Other arguments may contain credentials.
            if ($backendProcess.CommandLine -match '(?i)(?:^|\s)-jar\s+(?:"([^"]+)"|(\S+))') {
                $processJar = $Matches[1]
                if (-not $processJar) { $processJar = $Matches[2] }
                Add-Report ('Running JAR argument: ' + $processJar)
                if (-not $JarPath -and [IO.Path]::IsPathRooted($processJar)) { $JarPath = $processJar }
                if (-not [IO.Path]::IsPathRooted($processJar)) {
                    Add-Report 'Running JAR path is relative. Use -JarPath with its actual absolute path to check the file.'
                }
            }
        }
    } catch {
        Add-Report ('Process inspection unavailable: ' + $_.Exception.Message)
    }

    if ($JarPath) {
        try {
            $jarFile = Get-Item -LiteralPath $JarPath
            Add-Report ('JAR checked: ' + $jarFile.FullName)
            Add-Report ('JAR modified UTC: ' + $jarFile.LastWriteTimeUtc.ToString('o'))
            Add-Report ('JAR SHA256: ' + (Get-FileHash -LiteralPath $jarFile.FullName -Algorithm SHA256).Hash)
            if ($backendStartUtc -and $jarFile.LastWriteTimeUtc -gt $backendStartUtc) {
                Add-Report 'JAR MODIFIED AFTER PROCESS START: confirm the backend was restarted after the update.'
            }
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $archive = [IO.Compression.ZipFile]::OpenRead($jarFile.FullName)
            try {
                foreach ($library in @($archive.Entries | Where-Object {
                    $_.FullName -match '^BOOT-INF/lib/(?:logback-classic-[^/]+|richy-api-[^/]+)\.jar$'
                })) {
                    $buffer = New-Object IO.MemoryStream
                    $libraryStream = $library.Open()
                    try { $libraryStream.CopyTo($buffer) } finally { $libraryStream.Dispose() }
                    $buffer.Position = 0
                    $nested = New-Object IO.Compression.ZipArchive($buffer, [IO.Compression.ZipArchiveMode]::Read)
                    try {
                        if ($library.FullName -match 'logback-classic') {
                            Add-Report ('ThrowableProxy present: ' + [bool]$nested.GetEntry('ch/qos/logback/classic/spi/ThrowableProxy.class'))
                        } else {
                            foreach ($className in @('domain/Question.class', 'dto/QuestionDto.class')) {
                                $entry = $nested.GetEntry('com/globits/richy/' + $className)
                                $classBuffer = New-Object IO.MemoryStream
                                if ($entry) {
                                    $classStream = $entry.Open()
                                    try { $classStream.CopyTo($classBuffer) } finally { $classStream.Dispose() }
                                    $classText = [Text.Encoding]::ASCII.GetString($classBuffer.ToArray())
                                    Add-Report ($className + ' video fields: ' + ($classText.Contains('videoUrl') -and $classText.Contains('videoTimeSeconds')))
                                } else { Add-Report ($className + ' NOT FOUND') }
                                $classBuffer.Dispose()
                            }
                        }
                    } finally { $nested.Dispose(); $buffer.Dispose() }
                }
            } finally { $archive.Dispose() }
        } catch { Add-Report ('JAR inspection failed: ' + $_.Exception.Message) }
    }

    # These are unauthenticated GET requests. They cannot create or update data.
    # 401/403/405 are useful: the application has returned an HTTP response.
    Test-Endpoint 'Local Question API' ('http://127.0.0.1:' + $Port + '/service/api/question/save')
    Test-Endpoint 'Local Topic API' ('http://127.0.0.1:' + $Port + '/service/api/topic/save')
    Test-Endpoint 'Public frontend' ($SiteUrl.TrimEnd('/') + '/create_comprehensive_test')
    Test-Endpoint 'Public Question API' ($SiteUrl.TrimEnd('/') + '/service/api/question/save')
    Test-Endpoint 'Public Topic API' ($SiteUrl.TrimEnd('/') + '/service/api/topic/save')
} finally {
    $reportLines | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    Write-Output ('Report saved: ' + [IO.Path]::GetFullPath($ReportPath))
}
