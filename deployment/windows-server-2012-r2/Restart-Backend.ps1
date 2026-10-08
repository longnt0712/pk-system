[CmdletBinding()]
param(
    [string]$JarPath = 'C:\richy-wine-service\richy-wine-exec.jar',
    [string]$ExpectedComputer = '118-27-192-59',
    [ValidateRange(1, 65535)][int]$Port = 8085,
    [ValidatePattern('^[A-Za-z0-9_.-]+$')][string]$ServiceName = 'richy-wine-service',
    [switch]$CheckOnly
)

# Restart only the Java backend already serving this port. Preserve its JVM
# and application arguments; never print those arguments or replace the JAR.
$ErrorActionPreference = 'Stop'
$restartScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-BackendProcessId {
    $processIds = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    if ($processIds.Count -ne 1) {
        throw ('Expected one listening process on port ' + $Port + '; found ' + $processIds.Count + '.')
    }
    return [int]$processIds[0]
}

function Get-JavaArguments([string]$CommandLine, [string]$Executable, [string]$TargetJar) {
    if ([string]::IsNullOrWhiteSpace($Executable) -or [string]::IsNullOrWhiteSpace($CommandLine)) {
        throw 'The Java executable/startup command is unavailable. No process was stopped.'
    }
    $exeName = [IO.Path]::GetFileName($Executable)
    # WinSW can launch a full Java path without the .exe suffix.
    $executableWithoutExtension = $Executable -replace '(?i)\.exe$', ''
    $commandPattern = '^\s*(?:"' + [Regex]::Escape($Executable) + '"|' +
        [Regex]::Escape($Executable) + '|"' + [Regex]::Escape($executableWithoutExtension) + '"|' +
        [Regex]::Escape($executableWithoutExtension) + '|"?' + [Regex]::Escape($exeName) +
        '"?|java(?:w)?)(?:\s+|$)'
    $commandMatch = [Regex]::Match($CommandLine, $commandPattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $commandMatch.Success) { throw 'Cannot safely identify the Java executable in its startup command.' }
    $arguments = $CommandLine.Substring($commandMatch.Length)
    $jarMatch = [Regex]::Match($arguments, '(?:^|\s)-jar\s+(?:"([^"]+)"|(\S+))',
        [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $jarMatch.Success) { throw 'This Java process was not started with -jar. No process was stopped.' }
    $originalJar = $jarMatch.Groups[1].Value
    if (-not $originalJar) { $originalJar = $jarMatch.Groups[2].Value }
    if ([IO.Path]::IsPathRooted($originalJar)) {
        if ([IO.Path]::GetFullPath($originalJar) -ine $TargetJar) {
            throw 'The running process uses another JAR. No process was stopped.'
        }
    } elseif ($originalJar -ine [IO.Path]::GetFileName($TargetJar)) {
        # A relative subdirectory would require its original working directory.
        throw 'Cannot match the relative JAR path to the supplied folder. No process was stopped.'
    }
    return ($arguments.Substring(0, $jarMatch.Index) + ' -jar "' + $TargetJar + '"' +
        $arguments.Substring($jarMatch.Index + $jarMatch.Length))
}

function Test-ServiceWrapperPath([string]$ServiceCommand, [string]$ExpectedWrapperPath) {
    $pattern = '^\s*(?:"' + [Regex]::Escape($ExpectedWrapperPath) + '"|' +
        [Regex]::Escape($ExpectedWrapperPath) + ')(?:\s+|$)'
    return [Regex]::IsMatch($ServiceCommand, $pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

if ($env:COMPUTERNAME -ine $ExpectedComputer) {
    throw ('Run this script on server ' + $ExpectedComputer + '. Current computer: ' + $env:COMPUTERNAME)
}
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell with Run as administrator on the server.'
}
$jarFile = Get-Item -LiteralPath $JarPath
if ($jarFile.PSIsContainer) { throw 'JarPath must point to the JAR file.' }
$javaProcessId = Get-BackendProcessId
$javaRecord = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $javaProcessId)
if (-not $javaRecord -or $javaRecord.Name -notmatch '^javaw?\.exe$') {
    throw 'The process serving the port is not Java. No process was stopped.'
}
$javaArguments = Get-JavaArguments $javaRecord.CommandLine $javaRecord.ExecutablePath $jarFile.FullName
$javaDirectory = $jarFile.DirectoryName

# Reject an incomplete executable archive before interrupting the old process.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($jarFile.FullName)
try {
    if (-not $archive.GetEntry('org/springframework/boot/loader/JarLauncher.class') -or
            -not $archive.GetEntry('BOOT-INF/classes/com/globits/richy/RichyApplication.class')) {
        throw 'The file is not the expected executable backend JAR. No process was stopped.'
    }
} finally { $archive.Dispose() }

# A Java service may run directly or under a dedicated NSSM/WinSW/Tomcat
# service wrapper. Do not restart shared system services such as Task Scheduler.
$backendService = @(Get-CimInstance Win32_Service -Filter ('ProcessId=' + $javaProcessId))
if ($backendService.Count -eq 0 -and $javaRecord.ParentProcessId -gt 4) {
    $parentRecord = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $javaRecord.ParentProcessId)
    $parentServices = @(Get-CimInstance Win32_Service -Filter ('ProcessId=' + $javaRecord.ParentProcessId))
    if ($parentRecord -and $parentRecord.Name -notmatch '^(svchost|services|taskeng|taskhostw?)\.exe$') {
        $backendService = @($parentServices | Where-Object {
            $_.Name -match 'richy|wine|tomcat' -or
            $_.PathName -match [Regex]::Escape($javaDirectory) -or
            $_.PathName -match 'nssm|winsw|prunsrv'
        })
    }
}
if ($backendService.Count -gt 1) { throw 'More than one service matched the backend. No process was stopped.' }

# A failed WinSW stop can leave Java listening while its service is Stopped.
# Recover that exact service, rather than launching another unmanaged Java copy.
$recoverStoppedService = $false
if ($backendService.Count -eq 0) {
    $stoppedService = @(Get-CimInstance Win32_Service -Filter ("Name='" + $ServiceName + "'") |
        Where-Object { $_.State -eq 'Stopped' })
    $expectedWrapperPath = Join-Path $javaDirectory ($ServiceName + '.exe')
    if ($stoppedService.Count -eq 1 -and
        (Test-Path -LiteralPath $expectedWrapperPath -PathType Leaf) -and
        (Test-ServiceWrapperPath $stoppedService[0].PathName $expectedWrapperPath)) {
        $backendService = $stoppedService
        $recoverStoppedService = $true
    }
}
Write-Output ('Backend PID: ' + $javaProcessId)
Write-Output ('Started: ' + (Get-Process -Id $javaProcessId).StartTime.ToString('yyyy-MM-dd HH:mm:ss'))
Write-Output ('JAR: ' + $jarFile.FullName)
Write-Output ('Java: ' + $javaRecord.ExecutablePath)
Write-Output ('Working directory for a direct launch: ' + $javaDirectory)
if ($backendService.Count -eq 1) { Write-Output ('Windows service: ' + $backendService[0].Name) }
if ($recoverStoppedService) { Write-Output 'Recovery: stop the orphan Java listener, then start its existing Windows service.' }
if ($CheckOnly) { Write-Output 'Check only. No process or service was restarted.'; return }

# Recheck ownership so a concurrently restarted process is never stopped.
if ((Get-BackendProcessId) -ne $javaProcessId) { throw 'The listening process changed. Run the script again.' }
if ($recoverStoppedService) {
    $currentService = Get-CimInstance Win32_Service -Filter ("Name='" + $backendService[0].Name + "'")
    if ($currentService.State -ne 'Stopped') { throw 'The service state changed. No process was stopped; run the script again.' }
    Write-Output ('Stopping orphan Java PID ' + $javaProcessId + '...')
    Stop-Process -Id $javaProcessId -Force
    Wait-Process -Id $javaProcessId -Timeout 10 -ErrorAction SilentlyContinue
    $portDeadline = [DateTime]::UtcNow.AddSeconds(10)
    do {
        $remainingListeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
        if ($remainingListeners.Count -eq 0) { break }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $portDeadline)
    if ($remainingListeners.Count -ne 0) { throw 'The port is still occupied. The Windows service was not started.' }
    Write-Output ('Starting Windows service ' + $backendService[0].Name + ' with its existing configuration...')
    Start-Service -Name $backendService[0].Name -ErrorAction Stop
} elseif ($backendService.Count -eq 1) {
    Write-Output 'Restarting the existing Windows backend service...'
    Restart-Service -Name $backendService[0].Name -ErrorAction Stop
} else {
    Write-Output ('Stopping Java PID ' + $javaProcessId + '...')
    Stop-Process -Id $javaProcessId -Force
    Wait-Process -Id $javaProcessId -Timeout 10 -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    $newListeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($newListeners.Count -eq 0) {
        $logDirectory = Join-Path $javaDirectory 'backend-runtime-logs'
        New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
        $logStamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
        $stdoutPath = Join-Path $logDirectory ($logStamp + '.out.log')
        $stderrPath = Join-Path $logDirectory ($logStamp + '.err.log')
        Write-Output 'Starting Java with the existing JVM and application arguments...'
        $newJava = Start-Process -FilePath $javaRecord.ExecutablePath -ArgumentList $javaArguments -WorkingDirectory $javaDirectory -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
        Write-Output ('New Java PID: ' + $newJava.Id)
        Write-Output ('Startup log: ' + $stdoutPath)
        Write-Output ('Error log: ' + $stderrPath)
    } else {
        # A supervisor already started the backend. Never launch a second copy.
        Write-Output 'The backend supervisor has already opened the port again.'
    }
}

$listenDeadline = [DateTime]::UtcNow.AddSeconds(60)
do {
    $readyListeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($readyListeners.Count -gt 0) { break }
    Start-Sleep -Seconds 2
} while ([DateTime]::UtcNow -lt $listenDeadline)
if ($readyListeners.Count -eq 0) { throw 'No listener after 60 seconds. Read the new startup/error log.' }
$confirmedProcessId = Get-BackendProcessId
if ($confirmedProcessId -eq $javaProcessId) { throw 'The original backend PID is still listening. Restart was not confirmed.' }
Write-Output ('Confirmed listener PID: ' + $confirmedProcessId)
$diagnosticScript = Join-Path $restartScriptDirectory 'Test-Backend.ps1'
if (Test-Path -LiteralPath $diagnosticScript) {
    Write-Output 'Checking the local and public APIs...'
    & $diagnosticScript -Port $Port -JarPath $jarFile.FullName -ReportPath (Join-Path $restartScriptDirectory 'backend-check-after-restart.txt')
}
