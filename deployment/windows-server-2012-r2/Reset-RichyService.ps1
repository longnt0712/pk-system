[CmdletBinding()]
param(
    [string]$ExpectedComputer = '118-27-192-59',
    [string]$BackendDirectory = 'C:\richy-wine-service',
    [ValidatePattern('^[A-Za-z0-9_.-]+$')][string]$ServiceName = 'richy-wine-service',
    [ValidateRange(1, 65535)][int]$Port = 8085,
    [ValidateRange(1, 600)][int]$StopTimeoutSeconds = 60,
    [ValidateRange(1, 600)][int]$StartTimeoutSeconds = 90,
    [switch]$CheckOnly
)

# Scheduled service restart only. Never launch java.exe directly or kill Java.
$ErrorActionPreference = 'Stop'
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$jarPath = [IO.Path]::GetFullPath((Join-Path $BackendDirectory 'richy-wine-exec.jar'))
$wrapperPath = [IO.Path]::GetFullPath((Join-Path $BackendDirectory ($ServiceName + '.exe')))
$logFile = ''
$mutex = $null
$hasMutex = $false
$controller = $null
$exitCode = 1

function Write-ResetLog([string]$Message) {
    $line = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss') + ' ' + $Message
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
    Write-Output $line
}

function Get-BackendSnapshot {
    $service = Get-CimInstance Win32_Service -Filter ("Name='" + $ServiceName + "'")
    if (-not $service) { throw ('Service not found: ' + $ServiceName) }
    $wrapperPattern = '^\s*(?:"' + [regex]::Escape($wrapperPath) + '"|' + [regex]::Escape($wrapperPath) + ')(?:\s+|$)'
    if (-not [regex]::IsMatch($service.PathName, $wrapperPattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        throw 'Service executable does not match the expected backend wrapper.'
    }
    $java = @(Get-CimInstance Win32_Process -Filter "Name='java.exe' OR Name='javaw.exe'" | Where-Object {
        $match = [regex]::Match([string]$_.CommandLine, '(?i)(?:^|\s)-jar\s+(?:"([^"]+)"|(\S+))')
        if ($match.Success) {
            $argument = $match.Groups[1].Value
            if (-not $argument) { $argument = $match.Groups[2].Value }
            if ([IO.Path]::IsPathRooted($argument)) {
                [IO.Path]::GetFullPath($argument) -ieq $jarPath
            } else {
                # An orphan with this relative JAR name also blocks a new start.
                $argument -ieq 'richy-wine-exec.jar' -or $argument -ieq '.\richy-wine-exec.jar'
            }
        }
    })
    # Query listening sockets first so an empty target port is not confused with
    # a failed inspection of that port. Inspection errors must abort the reset.
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq $Port })
    return [pscustomobject]@{ Service = $service; Java = $java; Listeners = $listeners }
}

function Assert-OwnedBackend($Snapshot) {
    if ($Snapshot.Java.Count -gt 1) { throw 'Multiple backend Java processes found. Resolve them before scheduling another reset.' }
    foreach ($java in $Snapshot.Java) {
        if ($Snapshot.Service.State -ne 'Running' -or $Snapshot.Service.ProcessId -le 0 -or
            $java.ParentProcessId -ne $Snapshot.Service.ProcessId) {
            throw 'Backend Java is not a child of the running service wrapper. A new service start was blocked.'
        }
    }
    foreach ($listener in $Snapshot.Listeners) {
        if ($Snapshot.Java.Count -ne 1 -or $listener.OwningProcess -ne $Snapshot.Java[0].ProcessId) {
            throw ('Port ' + $Port + ' belongs to an unverified process. A new service start was blocked.')
        }
    }
}

try {
    if ($env:COMPUTERNAME -ine $ExpectedComputer) { throw ('Run this script on ' + $ExpectedComputer + '.') }
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run PowerShell or the scheduled task with administrator privileges.'
    }
    Add-Type -AssemblyName System.ServiceProcess
    if (-not (Test-Path -LiteralPath $jarPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $wrapperPath -PathType Leaf)) { throw 'Expected backend JAR or service wrapper is missing.' }
    $logDirectory = Join-Path $scriptDirectory 'reset-logs'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $logFile = Join-Path $logDirectory ('reset_' + (Get-Date -Format 'yyyyMMdd_HHmmss_fff') + '_' + $PID + '.log')
    $mutex = New-Object System.Threading.Mutex($false, ('Global\PkSystemReset_' + $ServiceName))
    try { $hasMutex = $mutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $hasMutex = $true }
    if ($hasMutex) {
        $before = Get-BackendSnapshot
        Assert-OwnedBackend $before
        Write-ResetLog ('Before reset: service=' + $before.Service.State + '; wrapper PID=' + $before.Service.ProcessId + '; backend Java count=' + $before.Java.Count)
        foreach ($java in $before.Java) { Write-ResetLog ('Java PID=' + $java.ProcessId + '; parent PID=' + $java.ParentProcessId + '; created=' + $java.CreationDate) }
        if ($before.Service.State -notin @('Running', 'Stopped')) { throw 'Service is already starting or stopping. No new restart was requested.' }
        if ($CheckOnly) {
            Write-ResetLog 'CHECK ONLY: ownership checks passed. No process or service was changed.'
        } else {
            $controller = Get-Service -Name $ServiceName -ErrorAction Stop
            $controller.Refresh()
            if ([string]$controller.Status -ne $before.Service.State) { throw 'Service state changed during inspection. No restart was requested.' }
            if ($before.Service.State -eq 'Running') {
                $activeDependents = @($controller.DependentServices | Where-Object { $_ -and [string]$_.Status -ne 'Stopped' })
                if ($activeDependents.Count -gt 0) { throw 'Other running services depend on this service. Automatic reset was blocked.' }
                Write-ResetLog 'Requesting service stop...'
                $controller.Stop()
                $controller.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Stopped, [TimeSpan]::FromSeconds($StopTimeoutSeconds))
            }
            # A Stopped wrapper does not prove that its Java child has exited.
            $deadline = [DateTime]::UtcNow.AddSeconds($StopTimeoutSeconds)
            do {
                $stopped = Get-BackendSnapshot
                if ($stopped.Service.State -ne 'Stopped') { throw 'Service changed state while waiting for shutdown. No start was requested.' }
                $oldJavaAlive = @($before.Java | Where-Object { Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.ProcessId) })
                if ($oldJavaAlive.Count -eq 0 -and $stopped.Java.Count -eq 0 -and $stopped.Listeners.Count -eq 0) { break }
                if ([DateTime]::UtcNow -ge $deadline) { throw 'Old Java or the backend port is still active after shutdown. No service start was requested.' }
                Start-Sleep -Milliseconds 500
            } while ($true)
            # Start through the same Windows service and its existing configuration.
            # Another caller starting this service cannot create an unmanaged Java copy here.
            Write-ResetLog 'Old Java exited and backend port is clear. Starting the existing Windows service...'
            $controller.Refresh()
            if ([string]$controller.Status -ne 'Stopped') { throw 'Service is no longer stopped. No start was requested.' }
            $controller.Start()
            $controller.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds($StartTimeoutSeconds))
            $deadline = [DateTime]::UtcNow.AddSeconds($StartTimeoutSeconds)
            do {
                $after = Get-BackendSnapshot
                if ($after.Service.State -ne 'Running') { throw 'Service stopped before its backend became ready.' }
                Assert-OwnedBackend $after
                if ($after.Java.Count -eq 1 -and $after.Listeners.Count -gt 0) { break }
                if ([DateTime]::UtcNow -ge $deadline) { throw 'Service started but no verified Java listener appeared before the startup timeout.' }
                Start-Sleep -Milliseconds 500
            } while ($true)
            Write-ResetLog ('SUCCESS: wrapper PID=' + $after.Service.ProcessId + '; Java PID=' + $after.Java[0].ProcessId + '; listening port=' + $Port)
        }
        $exitCode = 0
    } else {
        Write-ResetLog 'SKIPPED: another copy of this reset script is already running.'
        $exitCode = 0
    }
} catch {
    $message = 'ERROR: ' + $_.Exception.Message
    [Console]::Error.WriteLine($message)
    if ($logFile) { try { Add-Content -LiteralPath $logFile -Value $message -Encoding UTF8 } catch {} }
} finally {
    if ($controller) { $controller.Dispose() }
    if ($hasMutex) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
exit $exitCode
