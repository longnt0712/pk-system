# Run under Windows PowerShell. Only isolated fixture files are changed; Windows
# services, processes, sockets and HTTP responses are simulated.
$ErrorActionPreference = 'Stop'
$productionDirectory = Split-Path -Parent $PSScriptRoot
$repositoryDirectory = Split-Path -Parent (Split-Path -Parent $productionDirectory)
$testTempRoot = Join-Path $repositoryDirectory '.tmp'
$fixtureRoot = [IO.Path]::GetFullPath((Join-Path $testTempRoot ('pk-deploy-test-' + [Guid]::NewGuid().ToString('N'))))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
$productionSource = [IO.File]::ReadAllText((Join-Path $productionDirectory 'Reset-RichyService.ps1'))
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

function New-FixtureJar([string]$Path, [string]$Version, [switch]$MissingApplication) {
    $archive = [IO.Compression.ZipFile]::Open($Path, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $archive.CreateEntry('org/springframework/boot/loader/JarLauncher.class') | Out-Null
        if (-not $MissingApplication) { $archive.CreateEntry('BOOT-INF/classes/com/globits/richy/RichyApplication.class') | Out-Null }
        $entry = $archive.CreateEntry('fixture-version.txt')
        $writer = New-Object IO.StreamWriter($entry.Open())
        try { $writer.Write($Version) } finally { $writer.Dispose() }
    } finally { $archive.Dispose() }
}

$shim = @'
$ErrorActionPreference = 'Stop'
$script:scenario = '__SCENARIO__'
$script:state = 'Running'
$script:javaAlive = $true
$script:servicePid = 4268
$script:javaPid = 4208
$script:startCount = 0
$script:stopCount = 0
$script:healthCount = 0
$script:actionsPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'actions.txt'
[IO.File]::WriteAllText($script:actionsPath, '')
function Copy-Item {
    [CmdletBinding()]
    param([string]$LiteralPath, [string]$Destination, [switch]$Force)
    if ($script:scenario -eq 'backup-copy-failure' -and (Split-Path -Leaf (Split-Path -Parent $Destination)) -eq 'rollback') {
        throw 'Simulated backup copy failure after shutdown.'
    }
    Microsoft.PowerShell.Management\Copy-Item -LiteralPath $LiteralPath -Destination $Destination -Force:$Force -ErrorAction Stop
}
function Get-CimInstance {
    param([string]$ClassName, [string]$Filter)
    if ($ClassName -eq 'Win32_Service') {
        return [pscustomobject]@{ Name='richy-wine-service'; State=$script:state; ProcessId=$script:servicePid; PathName=('"' + (Join-Path $BackendDirectory 'richy-wine-service.exe') + '"') }
    }
    if ($ClassName -eq 'Win32_Process') {
        if (-not $script:javaAlive) { return @() }
        $java = [pscustomobject]@{ Name='java.exe'; ProcessId=$script:javaPid; ParentProcessId=$script:servicePid; CommandLine='java -jar richy-wine-exec.jar'; CreationDate=[DateTime]'2026-10-25T09:00:00' }
        if ($Filter -eq "Name='java.exe' OR Name='javaw.exe'" -or $Filter -eq ('ProcessId=' + $script:javaPid)) { return $java }
        return @()
    }
    throw 'Unexpected simulated inspection.'
}
function Get-NetTCPConnection {
    if ($script:javaAlive -and -not ($script:scenario -eq 'startup-listener-timeout' -and $script:startCount -eq 1)) {
        $owner = $script:javaPid
        if ($script:scenario -eq 'rollback-foreign-port' -and $script:healthCount -gt 0 -and $script:startCount -eq 1) { $owner = 1111 }
        return [pscustomobject]@{ LocalPort=8085; OwningProcess=$owner }
    }
    return @()
}
function Get-Service {
    $control = [pscustomobject]@{ Status=$script:state; DependentServices=@() }
    $control | Add-Member ScriptMethod Refresh { $this.Status = $script:state }
    $control | Add-Member ScriptMethod Stop {
        Add-Content -LiteralPath $script:actionsPath -Value 'STOP'
        $script:stopCount++
        if ($script:scenario -eq 'stop-denied' -or ($script:scenario -eq 'rollback-stop-denied' -and $script:stopCount -eq 2)) { throw 'Simulated service stop denied.' }
        $script:state = 'Stopped'
        if ($script:scenario -ne 'orphan-after-stop' -and -not ($script:scenario -eq 'rollback-orphan' -and $script:stopCount -eq 2)) { $script:javaAlive = $false }
    }
    $control | Add-Member ScriptMethod WaitForStatus {
        param($Status, $Timeout)
        if ($script:scenario -eq 'stop-timeout' -and [string]$Status -eq 'Stopped') { throw 'Simulated service stop timeout.' }
        $this.Status = $script:state
    }
    $control | Add-Member ScriptMethod Start {
        if ($script:state -ne 'Stopped' -or $script:javaAlive) { throw 'Attempt to start while Java is still active.' }
        Add-Content -LiteralPath $script:actionsPath -Value 'START'
        $script:startCount++
        $installedHash = (Get-FileHash -LiteralPath (Join-Path $BackendDirectory 'richy-wine-exec.jar') -Algorithm SHA256).Hash
        Add-Content -LiteralPath (Join-Path $BackendDirectory 'started-hashes.txt') -Value $installedHash
        if ($script:scenario -eq 'startup-failure' -and $script:startCount -eq 1) { throw 'Simulated replacement startup failure.' }
        $script:state = 'Running'
        $script:servicePid = 5000 + ($script:startCount * 10)
        $script:javaPid = $script:servicePid + 1
        $script:javaAlive = $true
    }
    $control | Add-Member ScriptMethod Dispose {}
    return $control
}
function Stop-Process { throw 'Must never kill processes.' }
function Start-Process { throw 'Must never launch Java directly.' }
'@

# Install this mock after the real HTTP boundary has been defined. Exercise the
# production retry/status logic and all lifecycle/file code around that boundary.
$httpShim = @'
function Get-BackendHealthStatus([Uri]$Uri, [int]$TimeoutMilliseconds) {
    if ($Uri.Port -ne 8085 -or $Uri.Scheme -notin @('http', 'https') -or $TimeoutMilliseconds -lt 1) { throw 'Invalid simulated health request.' }
    $script:healthCount++
    Add-Content -LiteralPath (Join-Path $BackendDirectory 'health-calls.txt') -Value ([string]$script:startCount)
    if ($script:startCount -eq 1) {
        if ($script:scenario -eq 'http-retry') {
            if ($script:healthCount -eq 1) { return 0 }
            if ($script:healthCount -eq 2) { return 503 }
        }
        if ($script:scenario -in @('http-timeout', 'rollback-stop-denied', 'rollback-orphan', 'rollback-foreign-port')) { return 503 }
        if ($script:scenario -eq 'http-transport-timeout') { return 0 }
        if ($script:scenario -eq 'http-404') { return 404 }
        if ($script:scenario -eq 'http-redirect') { return 302 }
    }
    if ($script:scenario -eq 'http-401') { return 401 }
    if ($script:scenario -eq 'http-403') { return 403 }
    if ($script:scenario -eq 'http-405') { return 405 }
    return 200
}

'@

$scenarios = @('good-deploy', 'check-only', 'stop-denied', 'stop-timeout', 'orphan-after-stop', 'backup-copy-failure',
    'startup-failure', 'startup-listener-timeout', 'http-timeout', 'http-transport-timeout', 'http-retry',
    'http-401', 'http-403', 'http-405', 'http-404', 'http-redirect', 'rollback-stop-denied', 'rollback-orphan',
    'rollback-foreign-port', 'bad-hash', 'missing-application', 'invalid-zip', 'missing-hash', 'missing-path',
    'invalid-hash', 'remote-uri', 'wrong-port-uri', 'credentials-uri', 'ipv6-loopback', 'overlap')
try {
    foreach ($scenario in $scenarios) {
        $caseDirectory = Join-Path $fixtureRoot $scenario
        New-Item -ItemType Directory -Path $caseDirectory | Out-Null
        $installedJar = Join-Path $caseDirectory 'richy-wine-exec.jar'
        $replacementJar = Join-Path $caseDirectory 'replacement.jar'
        New-FixtureJar $installedJar 'old version'
        New-FixtureJar $replacementJar 'new version' -MissingApplication:($scenario -eq 'missing-application')
        if ($scenario -eq 'invalid-zip') { [IO.File]::WriteAllText($replacementJar, 'not a ZIP') }
        $originalHash = (Get-FileHash -LiteralPath $installedJar -Algorithm SHA256).Hash
        $replacementHash = (Get-FileHash -LiteralPath $replacementJar -Algorithm SHA256).Hash
        [IO.File]::WriteAllText((Join-Path $caseDirectory 'richy-wine-service.exe'), 'fixture only')
        $source = $productionSource.Replace("`$ErrorActionPreference = 'Stop'", $shim.Replace('__SCENARIO__', $scenario))
        $source = $source.Replace('function Wait-BackendHealth([Uri]$Uri) {', ($httpShim + 'function Wait-BackendHealth([Uri]$Uri) {'))
        $source = $source.Replace('if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {', 'if ($false) {')
        $caseScript = Join-Path $caseDirectory 'Reset-RichyService.ps1'
        [IO.File]::WriteAllText($caseScript, $source, [Text.Encoding]::UTF8)
        $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $caseScript,
            '-ExpectedComputer', $env:COMPUTERNAME, '-BackendDirectory', $caseDirectory,
            '-StopTimeoutSeconds', '1', '-StartTimeoutSeconds', '1', '-HealthTimeoutSeconds', '2')
        if ($scenario -ne 'missing-path') { $arguments += @('-ReplacementJarPath', $replacementJar) }
        if ($scenario -ne 'missing-hash') {
            $suppliedHash = $replacementHash
            if ($scenario -eq 'bad-hash') { $suppliedHash = '0' * 64 }
            if ($scenario -eq 'invalid-hash') { $suppliedHash = 'invalid' }
            $arguments += @('-ExpectedSha256', $suppliedHash)
        }
        if ($scenario -eq 'check-only') { $arguments += '-CheckOnly' }
        switch ($scenario) {
            'remote-uri' { $arguments += @('-HealthCheckUri', 'http://example.com:8085/service/api/topic/get_one/1') }
            'wrong-port-uri' { $arguments += @('-HealthCheckUri', 'http://127.0.0.1:8086/service/api/topic/get_one/1') }
            'credentials-uri' { $arguments += @('-HealthCheckUri', 'http://secret:secret@127.0.0.1:8085/service/api/topic/get_one/1') }
            'ipv6-loopback' { $arguments += @('-HealthCheckUri', 'http://[::1]:8085/service/api/topic/get_one/1') }
        }
        $heldMutex = $null
        if ($scenario -eq 'overlap') {
            $heldMutex = New-Object System.Threading.Mutex($false, 'Global\PkSystemReset_richy-wine-service')
            if (-not $heldMutex.WaitOne(0)) { throw 'Cannot acquire test lifecycle mutex.' }
        }
        try {
            $previousPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            try { $output = (& powershell.exe @arguments 2>&1 | Out-String); $result = $LASTEXITCODE }
            finally { $ErrorActionPreference = $previousPreference }
        } finally {
            if ($heldMutex) { $heldMutex.ReleaseMutex(); $heldMutex.Dispose() }
        }
        $actions = @(Get-Content -LiteralPath (Join-Path $caseDirectory 'actions.txt') | Where-Object { $_ }) -join ','
        $expectedActions = ''
        $expectedResult = 1
        $expectedHash = $originalHash
        $expectBackup = $false
        $expectedLog = 'ERROR:'
        if ($scenario -in @('good-deploy', 'http-retry', 'http-401', 'http-403', 'http-405', 'ipv6-loopback')) {
            $expectedResult = 0; $expectedActions = 'STOP,START'; $expectedHash = $replacementHash
            $expectBackup = $true; $expectedLog = 'SUCCESS: deployment'
        } elseif ($scenario -eq 'check-only') {
            $expectedResult = 0; $expectedLog = 'CHECK ONLY:'
        } elseif ($scenario -in @('stop-denied', 'stop-timeout', 'orphan-after-stop')) {
            $expectedActions = 'STOP'; $expectedLog = 'original JAR was not overwritten'
        } elseif ($scenario -eq 'backup-copy-failure') {
            $expectedActions = 'STOP,START'; $expectedLog = 'RECOVERY SUCCESS:'
        } elseif ($scenario -eq 'startup-failure') {
            $expectedActions = 'STOP,START,START'; $expectBackup = $true; $expectedLog = 'ROLLBACK SUCCESS:'
        } elseif ($scenario -in @('startup-listener-timeout', 'http-timeout', 'http-transport-timeout', 'http-404', 'http-redirect')) {
            $expectedActions = 'STOP,START,STOP,START'; $expectBackup = $true; $expectedLog = 'ROLLBACK SUCCESS:'
        } elseif ($scenario -in @('rollback-stop-denied', 'rollback-orphan', 'rollback-foreign-port')) {
            $expectedActions = 'STOP,START,STOP'
            if ($scenario -eq 'rollback-foreign-port') { $expectedActions = 'STOP,START' }
            $expectedHash = $replacementHash; $expectBackup = $true; $expectedLog = 'ROLLBACK FAILED:'
        } elseif ($scenario -eq 'overlap') { $expectedResult = 75; $expectedLog = 'DEFERRED:' }
        $actualHash = (Get-FileHash -LiteralPath $installedJar -Algorithm SHA256).Hash
        if ($result -ne $expectedResult -or $actions -ne $expectedActions -or $actualHash -ne $expectedHash) {
            throw ("Failed ${scenario}: expected ${expectedResult}/${expectedActions}/${expectedHash}; got ${result}/${actions}/${actualHash}. " + $output)
        }
        if ($scenario -in @('missing-hash', 'missing-path', 'invalid-hash')) {
            if ($output -notmatch 'must be supplied together') { throw ('Missing parameter validation for ' + $scenario) }
        } else {
            $logs = @(Get-ChildItem -LiteralPath (Join-Path $caseDirectory 'reset-logs') -Filter '*.log')
            if ($logs.Count -ne 1 -or [IO.File]::ReadAllText($logs[0].FullName) -notmatch [regex]::Escape($expectedLog)) {
                throw ('Required deployment result was not logged for ' + $scenario + ': ' + $output)
            }
        }
        if ($output -match 'secret') { throw 'Health URI credentials leaked into output.' }
        $backups = @()
        if (Test-Path -LiteralPath (Join-Path $caseDirectory 'rollback')) { $backups = @(Get-ChildItem -LiteralPath (Join-Path $caseDirectory 'rollback') -Filter '*.jar') }
        if (($expectBackup -and $backups.Count -ne 1) -or (-not $expectBackup -and $backups.Count -ne 0)) { throw ('Unexpected rollback archive count for ' + $scenario) }
        foreach ($backup in $backups) {
            if ((Get-FileHash -LiteralPath $backup.FullName -Algorithm SHA256).Hash -ne $originalHash) { throw 'Rollback archive does not preserve the previous JAR.' }
        }
        $startedHashes = @()
        if (Test-Path -LiteralPath (Join-Path $caseDirectory 'started-hashes.txt')) { $startedHashes = @(Get-Content -LiteralPath (Join-Path $caseDirectory 'started-hashes.txt')) }
        $expectedFirstStartHash = $replacementHash
        if ($scenario -eq 'backup-copy-failure') { $expectedFirstStartHash = $originalHash }
        if ($startedHashes.Count -gt 0 -and $startedHashes[0] -ne $expectedFirstStartHash) { throw 'Expected JAR was not verified and installed before service start.' }
        if ($startedHashes.Count -gt 1 -and $startedHashes[1] -ne $originalHash) { throw 'Original JAR was not restored before rollback service start.' }
        if ($expectedLog -eq 'ROLLBACK SUCCESS:' -and $output -notmatch 'HTTP smoke check passed with status 200') { throw 'Rollback did not verify the original HTTP route.' }
        if ($expectedLog -eq 'ROLLBACK FAILED:' -and $output -notmatch 'Manual recovery required') { throw 'Unsafe rollback did not report manual recovery.' }
        if (@(Get-ChildItem -LiteralPath $caseDirectory -Filter '*.tmp').Count -ne 0) { throw 'Deployment staging file was not cleaned up.' }
        Write-Output ('PASS: ' + $scenario)
    }
} finally {
    $tempPrefix = [IO.Path]::GetFullPath($testTempRoot).TrimEnd('\') + '\'
    if (-not $fixtureRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path -Leaf $fixtureRoot) -notmatch '^pk-deploy-test-[0-9a-f]{32}$') { throw 'Unexpected deployment cleanup directory.' }
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
}
