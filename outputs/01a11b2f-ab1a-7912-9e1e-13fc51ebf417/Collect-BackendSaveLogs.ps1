[CmdletBinding()]
param(
    [string]$BackendDirectory = 'C:\richy-wine-service',
    [ValidateRange(1, 65535)][int]$Port = 8085,
    [ValidateRange(50, 5000)][int]$TailLines = 500,
    [string]$ReportPath = ''
)

# Read-only collection. Never stop/restart Java or services, send API writes,
# or read the service XML (which may contain connection credentials).
$ErrorActionPreference = 'Stop'
$saveLogsScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $ReportPath = Join-Path $saveLogsScriptDirectory 'backend-save-log.txt'
}
$reportLines = New-Object 'System.Collections.Generic.List[string]'

function Add-Report([string]$Line) {
    $reportLines.Add($Line)
}

function Protect-LogLine([string]$Line) {
    $protected = [Regex]::Replace($Line,
        '(?i)(password|pwd|client_secret|access_token|refresh_token)(\s*[:=]\s*)("[^"]*"|''[^'']*''|[^\s&;,]+)',
        '$1$2[REDACTED]')
    return [Regex]::Replace($protected, '(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+', '$1[REDACTED]')
}

try {
    Add-Report ('Collected local time: ' + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))
    Add-Report ('Collected UTC: ' + [DateTime]::UtcNow.ToString('o'))
    Add-Report ('Computer: ' + $env:COMPUTERNAME)
    Add-Report ('Backend folder: ' + $BackendDirectory)
    Add-Report 'Purpose: investigate Topic and Question saves; listing and Test Result saves reportedly work.'
    Add-Report 'Collection does not change any process, service, JAR or database.'

    try {
        $processIds = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique)
        foreach ($backendId in $processIds) {
            $record = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $backendId)
            $process = Get-Process -Id $backendId
            Add-Report ('Listener PID: ' + $backendId + '; executable: ' + $record.ExecutablePath)
            Add-Report ('Process started local: ' + $process.StartTime.ToString('yyyy-MM-dd HH:mm:ss'))
            Add-Report ('Parent PID: ' + $record.ParentProcessId)
            if ($record.CommandLine -match '(?i)(?:^|\s)-jar\s+(?:"([^"]+)"|(\S+))') {
                $processJar = $Matches[1]
                if (-not $processJar) { $processJar = $Matches[2] }
                Add-Report ('Running JAR argument: ' + $processJar)
            }
        }
        if ($processIds.Count -eq 0) { Add-Report ('No listener found on port ' + $Port) }
        $directoryPattern = [Regex]::Escape($BackendDirectory.TrimEnd('\') + '\')
        $services = @(Get-CimInstance Win32_Service | Where-Object { $_.PathName -match $directoryPattern })
        foreach ($serviceRecord in $services) {
            Add-Report ('Service: ' + $serviceRecord.Name + '; state: ' + $serviceRecord.State +
                '; wrapper PID: ' + $serviceRecord.ProcessId)
        }
    } catch { Add-Report ('Process/service inspection unavailable: ' + $_.Exception.Message) }

    $jarPath = Join-Path $BackendDirectory 'richy-wine-exec.jar'
    if (Test-Path -LiteralPath $jarPath -PathType Leaf) {
        $jarFile = Get-Item -LiteralPath $jarPath
        Add-Report ('JAR modified local: ' + $jarFile.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))
        Add-Report ('JAR bytes: ' + $jarFile.Length)
        Add-Report ('JAR SHA256: ' + (Get-FileHash -LiteralPath $jarPath -Algorithm SHA256).Hash)
    }

    foreach ($logName in @('richy-wine-service.out.log', 'richy-wine-service.err.log', 'richy-wine-service.wrapper.log')) {
        Add-Report ''
        Add-Report ('=== ' + $logName + ' ===')
        $logPath = Join-Path $BackendDirectory $logName
        if (-not (Test-Path -LiteralPath $logPath -PathType Leaf)) {
            Add-Report 'Log file not found.'
            continue
        }
        try {
            $logFile = Get-Item -LiteralPath $logPath
            Add-Report ('Last modified local: ' + $logFile.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))
            Add-Report ('File bytes: ' + $logFile.Length + '; collecting last ' + $TailLines + ' lines.')
            Get-Content -LiteralPath $logPath -Tail $TailLines | ForEach-Object {
                Add-Report (Protect-LogLine $_)
            }
        } catch { Add-Report ('Log read failed: ' + $_.Exception.Message) }
    }
} finally {
    $reportLines | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    Write-Output ('Report saved: ' + [IO.Path]::GetFullPath($ReportPath))
    Write-Output 'No process, service, JAR or database was changed.'
}
