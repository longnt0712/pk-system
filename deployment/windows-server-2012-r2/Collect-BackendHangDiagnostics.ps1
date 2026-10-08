[CmdletBinding()]
param(
    [string]$BackendDirectory = 'C:\richy-wine-service',
    [ValidateRange(1, 65535)][int]$Port = 8085,
    [string]$JdkDirectory = '',
    [string]$ReportPath = ''
)

# Run WHILE a Topic/Question save or Battle request is still waiting.
# Read-only JVM inspection; no restart, API write, SQL write or force attach.
$ErrorActionPreference = 'Stop'
# Windows PowerShell can leave PSScriptRoot empty while evaluating param defaults.
# Resolve the script's own directory after parameter binding, including for siblings.
$diagnosticsScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $ReportPath = Join-Path $diagnosticsScriptDirectory 'backend-hang-diagnostics.txt'
}
$reportLines = New-Object 'System.Collections.Generic.List[string]'

function Add-Report([string]$Line) { $reportLines.Add($Line) }

function Protect-LogLine([string]$Line) {
    $protected = [Regex]::Replace($Line,
        '(?i)(password|pwd|client_secret|access_token|refresh_token)(\s*[:=]\s*)("[^"]*"|''[^'']*''|[^\s&;,]+)',
        '$1$2[REDACTED]')
    return [Regex]::Replace($protected, '(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+', '$1[REDACTED]')
}

function Find-JvmTool([string]$JavaPath) {
    $candidates = New-Object 'System.Collections.Generic.List[string]'
    if ($JdkDirectory) { $candidates.Add((Join-Path $JdkDirectory 'bin')) }
    if ($JavaPath) {
        $javaBin = Split-Path -Parent $JavaPath
        $candidates.Add($javaBin)
        # Java 8 can run from <jdk>\jre\bin while jcmd is in <jdk>\bin.
        $javaHome = Split-Path -Parent $javaBin
        if ((Split-Path -Leaf $javaHome) -eq 'jre') {
            $candidates.Add((Join-Path (Split-Path -Parent $javaHome) 'bin'))
        }
    }
    foreach ($name in @('jcmd.exe', 'jstack.exe')) {
        foreach ($directory in $candidates) {
            $candidate = Join-Path $directory $name
            if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
        }
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }
    return $null
}

function Collect-ThreadDump([string]$ToolPath, [int]$BackendId, [int]$Snapshot) {
    Add-Report ''
    Add-Report ('=== JVM thread snapshot ' + $Snapshot + ' at ' + [DateTime]::UtcNow.ToString('o') + ' ===')
    $outPath = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
    $errPath = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
    $helper = $null
    try {
        $arguments = @('-l', [string]$BackendId)
        if ((Split-Path -Leaf $ToolPath) -eq 'jcmd.exe') {
            $arguments = @([string]$BackendId, 'Thread.print', '-l')
        }
        $helper = Start-Process -FilePath $ToolPath -ArgumentList $arguments -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput $outPath -RedirectStandardError $errPath
        if (-not $helper.WaitForExit(15000)) {
            # Only stop the diagnostic helper we just launched, never the backend.
            Stop-Process -Id $helper.Id -ErrorAction SilentlyContinue
            Add-Report 'JVM inspection helper timed out after 15 seconds; backend was left running.'
        } else {
            Add-Report ('Inspection helper exit code: ' + $helper.ExitCode)
        }
        foreach ($path in @($outPath, $errPath)) {
            if (Test-Path -LiteralPath $path -PathType Leaf) {
                Get-Content -LiteralPath $path | ForEach-Object { Add-Report (Protect-LogLine $_) }
            }
        }
    } catch { Add-Report ('JVM inspection unavailable: ' + $_.Exception.Message) }
    finally {
        foreach ($path in @($outPath, $errPath)) {
            if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path -Force }
        }
    }
}

try {
    Add-Report ('Collected local time: ' + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))
    Add-Report ('Computer: ' + $env:COMPUTERNAME)
    Add-Report 'Purpose: identify the Java/SQL step waiting during Topic, Question and Battle operations.'
    Add-Report 'No backend process, service, JAR or database is changed.'
    $backendIds = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    if ($backendIds.Count -eq 0) { Add-Report ('No listener found on port ' + $Port) }
    foreach ($backendId in $backendIds) {
        $record = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $backendId)
        Add-Report ('Listener PID: ' + $backendId + '; executable: ' + $record.ExecutablePath)
        if (-not $record.ExecutablePath -or (Split-Path -Leaf $record.ExecutablePath) -notmatch '^javaw?\.exe$') {
            Add-Report 'Listener is not an identifiable Java process; JVM inspection skipped.'
            continue
        }
        $tool = Find-JvmTool $record.ExecutablePath
        if (-not $tool) {
            Add-Report 'No jcmd/jstack found. Rerun with -JdkDirectory pointing to an existing JDK matching this Java version.'
            continue
        }
        Add-Report ('JVM inspection tool: ' + $tool)
        Collect-ThreadDump $tool $backendId 1
        Start-Sleep -Seconds 5
        Collect-ThreadDump $tool $backendId 2
    }
} catch { Add-Report ('Inspection failed: ' + $_.Exception.Message) }
finally {
    $reportLines | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    Write-Output ('JVM report saved: ' + [IO.Path]::GetFullPath($ReportPath))
}

$logCollector = Join-Path $diagnosticsScriptDirectory 'Collect-BackendSaveLogs.ps1'
if (Test-Path -LiteralPath $logCollector -PathType Leaf) {
    & $logCollector -BackendDirectory $BackendDirectory -Port $Port `
        -ReportPath (Join-Path (Split-Path -Parent ([IO.Path]::GetFullPath($ReportPath))) 'backend-save-log.txt')
}
