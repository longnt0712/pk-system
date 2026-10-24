[CmdletBinding()]
param(
    [string]$ExpectedComputer = '118-27-192-59',
    [string]$BackendDirectory = 'C:\richy-wine-service',
    [ValidatePattern('^[A-Za-z0-9_.-]+$')][string]$ServiceName = 'richy-wine-service',
    [ValidateRange(1, 65535)][int]$Port = 8085,
    [ValidateRange(1, 600)][int]$StopTimeoutSeconds = 60,
    [ValidateRange(1, 600)][int]$StartTimeoutSeconds = 90,
    [string]$ReplacementJarPath = '',
    [string]$ExpectedSha256 = '',
    [string]$HealthCheckUri = 'http://127.0.0.1:8085/service/api/topic/get_one/1',
    [ValidateRange(1, 600)][int]$HealthTimeoutSeconds = 90,
    [switch]$CheckOnly
)

# Restart or replace the JAR through its existing service. Never launch or kill Java.
$ErrorActionPreference = 'Stop'
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$jarPath = [IO.Path]::GetFullPath((Join-Path $BackendDirectory 'richy-wine-exec.jar'))
$wrapperPath = [IO.Path]::GetFullPath((Join-Path $BackendDirectory ($ServiceName + '.exe')))
$logFile = ''
$mutex = $null
$hasMutex = $false
$controller = $null
$exitCode = 1
$isDeployment = -not [string]::IsNullOrWhiteSpace($ReplacementJarPath) -or -not [string]::IsNullOrWhiteSpace($ExpectedSha256)

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
    $allJava = @(Get-CimInstance Win32_Process -Filter "Name='java.exe' OR Name='javaw.exe'")
    $java = @($allJava | Where-Object {
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
    $wrapperJava = @($allJava | Where-Object { $service.ProcessId -gt 0 -and $_.ParentProcessId -eq $service.ProcessId })
    return [pscustomobject]@{ Service = $service; Java = $java; WrapperJava = $wrapperJava; Listeners = $listeners }
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

# These helpers are used only by an explicitly requested deployment. The daily
# reset below keeps its existing process/service checks and exit behavior.
function Get-JarSha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose(); $stream.Dispose() }
}

function Assert-JarArchive([string]$Path, [switch]$Executable) {
    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        if ($archive.Entries.Count -eq 0) { throw 'The backend JAR archive is empty.' }
        if ($Executable -and (-not $archive.GetEntry('org/springframework/boot/loader/JarLauncher.class') -or
            -not $archive.GetEntry('BOOT-INF/classes/com/globits/richy/RichyApplication.class'))) {
            throw 'The replacement is not the expected executable backend JAR.'
        }
    } finally { $archive.Dispose() }
}

function Assert-JarHash([string]$Path, [string]$Expected) {
    if ((Get-JarSha256 $Path) -ine $Expected) { throw 'Backend JAR SHA-256 verification failed.' }
}

function Get-DeploymentHealthUri {
    $uri = $null
    if (-not [Uri]::TryCreate($HealthCheckUri, [UriKind]::Absolute, [ref]$uri) -or
        $uri.Scheme -notin @('http', 'https') -or $uri.Port -ne 8085 -or $Port -ne 8085 -or $uri.UserInfo) {
        throw 'Deployment health check must use HTTP(S) on loopback port 8085 without credentials.'
    }
    $address = $null
    $loopback = $uri.DnsSafeHost -ieq 'localhost'
    if ([Net.IPAddress]::TryParse($uri.DnsSafeHost.Trim('[', ']'), [ref]$address)) { $loopback = [Net.IPAddress]::IsLoopback($address) }
    if (-not $loopback) { throw 'Deployment health check must use HTTP(S) on loopback port 8085.' }
    return $uri
}

function Get-BackendHealthStatus([Uri]$Uri, [int]$TimeoutMilliseconds) {
    # Disable proxies and redirects so the check cannot leave the validated local
    # endpoint. Never log response bodies, credentials or the request URI.
    $request = [Net.HttpWebRequest]::Create($Uri)
    $request.Method = 'GET'
    $request.AllowAutoRedirect = $false
    $request.Proxy = $null
    $request.Timeout = $TimeoutMilliseconds
    $request.ReadWriteTimeout = $TimeoutMilliseconds
    $response = $null
    try {
        try { $response = $request.GetResponse() }
        catch [Net.WebException] {
            if (-not $_.Exception.Response) { return 0 }
            $response = $_.Exception.Response
        }
        return [int]$response.StatusCode
    } finally { if ($response) { $response.Close() } }
}

function Wait-BackendHealth([Uri]$Uri) {
    $deadline = [DateTime]::UtcNow.AddSeconds($HealthTimeoutSeconds)
    do {
        $remaining = [int][Math]::Max(1, [Math]::Min(10000, ($deadline - [DateTime]::UtcNow).TotalMilliseconds))
        $status = Get-BackendHealthStatus $Uri $remaining
        if ($status -in @(200, 401, 403, 405)) {
            Write-ResetLog ('HTTP smoke check passed with status ' + $status + '.')
            return
        }
        if ($status -ne 0 -and ($status -lt 500 -or $status -gt 599)) {
            throw ('Backend HTTP smoke check returned unexpected status ' + $status + '.')
        }
        if ([DateTime]::UtcNow -ge $deadline) { throw 'Backend HTTP smoke check timed out after transport failures or HTTP 5xx responses.' }
        Start-Sleep -Milliseconds 500
    } while ($true)
}

function Get-DeploymentJava($Snapshot) {
    return @(@($Snapshot.Java) + @($Snapshot.WrapperJava) | Sort-Object ProcessId -Unique)
}

function Assert-DeploymentQuiescent($Previous) {
    $snapshot = Get-BackendSnapshot
    $trackedAlive = @(Get-DeploymentJava $Previous | Where-Object { Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.ProcessId) })
    if ($snapshot.Service.State -ne 'Stopped' -or (Get-DeploymentJava $snapshot).Count -ne 0 -or
        $snapshot.Listeners.Count -ne 0 -or $trackedAlive.Count -ne 0) {
        throw 'Backend Java or port is still active, or the service is not stopped. JAR replacement is blocked.'
    }
}

function Stop-DeploymentBackend($Previous, [switch]$ForRollback) {
    $current = Get-BackendSnapshot
    $allowedStates = @('Running', 'Stopped')
    if ($ForRollback) { $allowedStates += @('Start Pending', 'Stop Pending') }
    if ($current.Service.State -notin $allowedStates -or $current.Service.State -ne $Previous.Service.State -or
        $current.Service.ProcessId -ne $Previous.Service.ProcessId) { throw 'Service state changed during deployment inspection. Stop was blocked.' }
    if ($current.Service.State -ne 'Stopped') {
        $ownedJava = @(Get-DeploymentJava $current)
        foreach ($java in $ownedJava) {
            if ($current.Service.ProcessId -le 0 -or $java.ParentProcessId -ne $current.Service.ProcessId) {
                throw 'Deployment cannot safely stop an unverified backend Java process.'
            }
        }
        foreach ($listener in $current.Listeners) {
            if (@($ownedJava | Where-Object { $_.ProcessId -eq $listener.OwningProcess }).Count -eq 0) {
                throw 'Deployment cannot safely stop an unverified backend port owner.'
            }
        }
    }
    $script:controller.Refresh()
    if ([string]$script:controller.Status -ne $current.Service.State.Replace(' ', '')) { throw 'Service changed state before the deployment stop.' }
    if ($current.Service.State -in @('Running', 'Start Pending')) {
        $activeDependents = @($script:controller.DependentServices | Where-Object { $_ -and [string]$_.Status -ne 'Stopped' })
        if ($activeDependents.Count -gt 0) { throw 'Other running services depend on this service. Deployment stop was blocked.' }
        Write-ResetLog 'Requesting service stop for deployment...'
        $script:controller.Stop()
    }
    if ($current.Service.State -ne 'Stopped') {
        $script:controller.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Stopped, [TimeSpan]::FromSeconds($StopTimeoutSeconds))
    }
    $deadline = [DateTime]::UtcNow.AddSeconds($StopTimeoutSeconds)
    do {
        $stopped = Get-BackendSnapshot
        if ($stopped.Service.State -ne 'Stopped') { throw 'Service changed state while waiting for deployment shutdown.' }
        $oldJavaAlive = @(Get-DeploymentJava $Previous | Where-Object { Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.ProcessId) })
        if ($oldJavaAlive.Count -eq 0 -and (Get-DeploymentJava $stopped).Count -eq 0 -and $stopped.Listeners.Count -eq 0) { break }
        if ([DateTime]::UtcNow -ge $deadline) { throw 'Backend Java or port did not clear after the deployment stop. JAR replacement is blocked.' }
        Start-Sleep -Milliseconds 500
    } while ($true)
    Assert-DeploymentQuiescent $Previous
}

function Start-DeploymentBackend([Uri]$HealthUri) {
    $readyToStart = Get-BackendSnapshot
    Assert-DeploymentQuiescent $readyToStart
    $script:controller.Refresh()
    if ([string]$script:controller.Status -ne 'Stopped') { throw 'Service is no longer stopped. Deployment start was blocked.' }
    Write-ResetLog 'Starting the existing Windows service for deployment...'
    $script:controller.Start()
    $script:controller.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds($StartTimeoutSeconds))
    $deadline = [DateTime]::UtcNow.AddSeconds($StartTimeoutSeconds)
    do {
        $after = Get-BackendSnapshot
        if ($after.Service.State -ne 'Running') { throw 'Service stopped before the deployed backend became ready.' }
        Assert-OwnedBackend $after
        if ($after.WrapperJava.Count -ne $after.Java.Count) { throw 'Service started an unexpected Java child.' }
        if ($after.Java.Count -eq 1 -and $after.Listeners.Count -gt 0) { break }
        if ([DateTime]::UtcNow -ge $deadline) { throw 'Deployment startup timed out before a verified Java listener appeared.' }
        Start-Sleep -Milliseconds 500
    } while ($true)
    Wait-BackendHealth $HealthUri
    $after = Get-BackendSnapshot
    Assert-OwnedBackend $after
    if ($after.Service.State -ne 'Running' -or $after.Java.Count -ne 1 -or $after.Listeners.Count -eq 0 -or
        $after.WrapperJava.Count -ne 1) { throw 'Backend ownership or listener changed during the HTTP smoke check.' }
    Write-ResetLog ('Verified service: wrapper PID=' + $after.Service.ProcessId + '; Java PID=' + $after.Java[0].ProcessId + '; listening port=' + $Port)
}

function Invoke-BackendDeployment($Before, [string]$ReplacementPath, [string]$OriginalHash, [Uri]$HealthUri) {
    $backupPath = ''
    $candidatePath = ''
    $restorePath = ''
    $replacementAttempted = $false
    $shutdownCompleted = $false
    $script:controller = Get-Service -Name $ServiceName -ErrorAction Stop
    try {
        # Stage on the target volume before stopping anything. File.Replace then
        # publishes a complete, verified file rather than copying over a live name.
        $candidatePath = $jarPath + '.deploy-' + [Guid]::NewGuid().ToString('N') + '.tmp'
        Copy-Item -LiteralPath $ReplacementPath -Destination $candidatePath -ErrorAction Stop
        Assert-JarHash $candidatePath $ExpectedSha256
        Assert-JarArchive $candidatePath -Executable
        Stop-DeploymentBackend $Before
        $shutdownCompleted = $true
        $rollbackDirectory = Join-Path $BackendDirectory 'rollback'
        New-Item -ItemType Directory -Path $rollbackDirectory -Force | Out-Null
        $backupPath = Join-Path $rollbackDirectory ('richy-wine-exec_' + (Get-Date -Format 'yyyyMMdd_HHmmss_fff') + '_' + [Guid]::NewGuid().ToString('N') + '.jar')
        Copy-Item -LiteralPath $jarPath -Destination $backupPath -ErrorAction Stop
        Assert-JarHash $backupPath $OriginalHash
        Assert-JarArchive $backupPath
        Write-ResetLog ('Preserved verified previous JAR: ' + $backupPath)
        Assert-DeploymentQuiescent $Before
        $replacementAttempted = $true
        [IO.File]::Replace($candidatePath, $jarPath, [NullString]::Value)
        Assert-JarHash $jarPath $ExpectedSha256
        Assert-JarArchive $jarPath -Executable
        Start-DeploymentBackend $HealthUri
        Write-ResetLog 'SUCCESS: deployment JAR and HTTP smoke check verified.'
    } catch {
        $deploymentError = $_.Exception.Message
        if ($replacementAttempted) {
            Write-ResetLog ('DEPLOYMENT FAILED: ' + $deploymentError + ' Attempting rollback through the existing service.')
            try {
                Assert-JarHash $backupPath $OriginalHash
                Assert-JarArchive $backupPath
                $restorePath = $jarPath + '.restore-' + [Guid]::NewGuid().ToString('N') + '.tmp'
                Copy-Item -LiteralPath $backupPath -Destination $restorePath -ErrorAction Stop
                Assert-JarHash $restorePath $OriginalHash
                Assert-JarArchive $restorePath
                $failed = Get-BackendSnapshot
                Stop-DeploymentBackend $failed -ForRollback
                # Never overwrite a running/stranded candidate, even if the SCM
                # already reports Stopped. Keep all copies for manual recovery.
                Assert-DeploymentQuiescent $failed
                [IO.File]::Replace($restorePath, $jarPath, [NullString]::Value)
                Assert-JarHash $jarPath $OriginalHash
                Assert-JarArchive $jarPath
                Start-DeploymentBackend $HealthUri
                Write-ResetLog 'ROLLBACK SUCCESS: previous JAR restored and its service, Java listener and HTTP smoke check verified. Deployment remains failed.'
            } catch {
                Write-ResetLog ('ROLLBACK FAILED: ' + $_.Exception.Message + ' Manual recovery required; no further JAR changes will be attempted. Verified backup: ' + $backupPath)
            }
        } else {
            Write-ResetLog 'DEPLOYMENT FAILED before replacement. The original JAR was not overwritten.'
            if ($shutdownCompleted) {
                try {
                    Assert-JarHash $jarPath $OriginalHash
                    Assert-JarArchive $jarPath
                    Assert-DeploymentQuiescent $Before
                    Start-DeploymentBackend $HealthUri
                    Write-ResetLog 'RECOVERY SUCCESS: original JAR unchanged and its service, Java listener and HTTP smoke check verified. Deployment remains failed.'
                } catch {
                    Write-ResetLog ('RECOVERY FAILED: ' + $_.Exception.Message + ' Manual recovery required; the original JAR was not overwritten.')
                }
            }
        }
        throw ('Deployment failed: ' + $deploymentError)
    } finally {
        # Only remove the two uniquely named staging files created by this call.
        # Versioned rollback JARs are retained indefinitely.
        foreach ($temporaryPath in @($candidatePath, $restorePath)) {
            if ($temporaryPath -and (Test-Path -LiteralPath $temporaryPath -PathType Leaf)) {
                try { Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction Stop }
                catch { Write-ResetLog 'Could not remove a deployment staging file; manual cleanup may be needed.' }
            }
        }
    }
}

try {
    if ($isDeployment -and ([string]::IsNullOrWhiteSpace($ReplacementJarPath) -or $ExpectedSha256 -notmatch '^[A-Fa-f0-9]{64}$')) {
        throw 'ReplacementJarPath and a 64-character ExpectedSha256 must be supplied together.'
    }
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
        if ($isDeployment) {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $replacementPath = [IO.Path]::GetFullPath($ReplacementJarPath)
            if ($replacementPath -ieq $jarPath) { throw 'ReplacementJarPath must differ from the installed backend JAR.' }
            if (-not (Test-Path -LiteralPath $replacementPath -PathType Leaf)) { throw 'Replacement JAR does not exist.' }
            $healthUri = Get-DeploymentHealthUri
            Assert-JarHash $replacementPath $ExpectedSha256
            Assert-JarArchive $replacementPath -Executable
            Assert-JarArchive $jarPath
            $originalHash = Get-JarSha256 $jarPath
            Write-ResetLog 'Replacement SHA-256, executable JAR and local health-check configuration passed validation.'
        }
        $before = Get-BackendSnapshot
        Assert-OwnedBackend $before
        if ($isDeployment -and $before.WrapperJava.Count -ne $before.Java.Count) { throw 'Unexpected Java child of the service wrapper. Deployment was blocked.' }
        Write-ResetLog ('Before reset: service=' + $before.Service.State + '; wrapper PID=' + $before.Service.ProcessId + '; backend Java count=' + $before.Java.Count)
        foreach ($java in $before.Java) { Write-ResetLog ('Java PID=' + $java.ProcessId + '; parent PID=' + $java.ParentProcessId + '; created=' + $java.CreationDate) }
        if ($before.Service.State -notin @('Running', 'Stopped')) { throw 'Service is already starting or stopping. No new restart was requested.' }
        if ($CheckOnly) {
            Write-ResetLog 'CHECK ONLY: ownership checks passed. No process or service was changed.'
        } elseif ($isDeployment) {
            Invoke-BackendDeployment $before $replacementPath $originalHash $healthUri
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
        if ($isDeployment) {
            $exitCode = 75
            throw 'DEFERRED: backend lifecycle mutex is busy with another reset or deployment. Retry deployment later.'
        }
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
