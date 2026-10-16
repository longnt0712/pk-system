# Run under Windows PowerShell. All process, socket and service operations are simulated.
$ErrorActionPreference = 'Stop'
$productionDirectory = Split-Path -Parent $PSScriptRoot
$repositoryDirectory = Split-Path -Parent (Split-Path -Parent $productionDirectory)
$testTempRoot = Join-Path $repositoryDirectory '.tmp'
$fixtureRoot = [IO.Path]::GetFullPath((Join-Path $testTempRoot ('pk-reset-test-' + [Guid]::NewGuid().ToString('N'))))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
$productionSource = [IO.File]::ReadAllText((Join-Path $productionDirectory 'Reset-RichyService.ps1'))
$shim = @'
$ErrorActionPreference = 'Stop'
$script:scenario = '__SCENARIO__'
$script:state = 'Running'
if ($script:scenario -like 'stopped-*') { $script:state = 'Stopped' }
$script:javaAlive = $script:scenario -ne 'stopped-clean'
$script:started = $false
$script:servicePid = 4268
$script:javaPid = 4208
$script:afterStopPolls = 0
$script:actionsPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'actions.txt'
[IO.File]::WriteAllText($script:actionsPath, '')
function Get-CimInstance {
    param([string]$ClassName, [string]$Filter)
    if ($ClassName -eq 'Win32_Service') {
        $path = '"' + (Join-Path $BackendDirectory 'richy-wine-service.exe') + '"'
        if ($script:scenario -eq 'wrong-wrapper') { $path = 'C:\other\richy-wine-service.exe' }
        return [pscustomobject]@{ Name='richy-wine-service'; State=$script:state; ProcessId=$script:servicePid; PathName=$path }
    }
    if ($ClassName -eq 'Win32_Process') {
        if ($script:state -eq 'Stopped' -and -not $script:started -and $script:scenario -eq 'success') {
            $script:afterStopPolls++
            if ($script:afterStopPolls -ge 3) { $script:javaAlive = $false }
        }
        if (-not $script:javaAlive) { return @() }
        $parent = $script:servicePid
        if ($script:scenario -eq 'wrong-parent') { $parent = 9999 }
        $java = [pscustomobject]@{ Name='java.exe'; ProcessId=$script:javaPid; ParentProcessId=$parent; CommandLine='java -jar richy-wine-exec.jar'; CreationDate=[DateTime]'2026-10-16T15:00:04' }
        if ($Filter -eq "Name='java.exe' OR Name='javaw.exe'") {
            if ($script:scenario -eq 'duplicate-java') { return @($java, $java) }
            return $java
        }
        if ($Filter -eq ('ProcessId=' + $script:javaPid)) { return $java }
        return @()
    }
    throw ('Unexpected inspection: ' + $ClassName)
}
function Get-NetTCPConnection {
    if ($script:scenario -eq 'inspection-failure') { throw 'Simulated socket inspection failure.' }
    if ($script:javaAlive -and -not ($script:started -and $script:scenario -eq 'startup-timeout')) {
        $owner = $script:javaPid
        if ($script:scenario -eq 'foreign-port') { $owner = 1111 }
        return [pscustomobject]@{LocalPort=8085; OwningProcess=$owner}
    }
    return @()
}
function Get-Service {
    $control = [pscustomobject]@{ Status=$script:state }
    if ($script:scenario -eq 'active-dependent') {
        $control | Add-Member NoteProperty DependentServices @([pscustomobject]@{Name='other-service'; Status='Running'})
    }
    $control | Add-Member ScriptMethod Refresh { $this.Status=$script:state }
    $control | Add-Member ScriptMethod Stop {
        Add-Content -LiteralPath $script:actionsPath -Value 'STOP'
        if ($script:scenario -eq 'stop-denied') { throw 'Simulated Access is denied.' }
        $script:state = 'Stopped'
        if ($script:scenario -notin @('orphan-after-stop', 'success')) { $script:javaAlive = $false }
    }
    $control | Add-Member ScriptMethod WaitForStatus {
        param($Status, $Timeout)
        if ($script:scenario -eq 'stop-timeout' -and [string]$Status -eq 'Stopped') { throw 'Simulated stop timeout.' }
        $this.Status = $script:state
    }
    $control | Add-Member ScriptMethod Start {
        if ($script:state -ne 'Stopped' -or $script:javaAlive) { throw 'Attempted to start with an existing Java process.' }
        Add-Content -LiteralPath $script:actionsPath -Value 'START'
        $script:state = 'Running'
        $script:started = $true
        $script:servicePid = 5001
        $script:javaPid = 5002
        $script:javaAlive = $true
    }
    $control | Add-Member ScriptMethod Dispose {}
    return $control
}
function Stop-Process { throw 'Must never kill processes.' }
function Start-Process { throw 'Must never launch Java directly.' }
'@
$scenarios = @('success', 'stopped-clean', 'check-only', 'stop-denied', 'stop-timeout', 'orphan-after-stop',
    'stopped-orphan', 'wrong-parent', 'foreign-port', 'wrong-wrapper', 'duplicate-java', 'inspection-failure', 'startup-timeout', 'overlap', 'active-dependent')
try {
    foreach ($scenario in $scenarios) {
        $caseDirectory = Join-Path $fixtureRoot $scenario
        New-Item -ItemType Directory -Path $caseDirectory | Out-Null
        [IO.File]::WriteAllText((Join-Path $caseDirectory 'richy-wine-exec.jar'), 'fixture only')
        [IO.File]::WriteAllText((Join-Path $caseDirectory 'richy-wine-service.exe'), 'fixture only')
        $source = $productionSource.Replace("`$ErrorActionPreference = 'Stop'", $shim.Replace('__SCENARIO__', $scenario))
        $source = $source.Replace('if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {', 'if ($false) {')
        $caseScript = Join-Path $caseDirectory 'Reset-RichyService.ps1'
        [IO.File]::WriteAllText($caseScript, $source, [Text.Encoding]::UTF8)
        $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $caseScript,
            '-ExpectedComputer', $env:COMPUTERNAME, '-BackendDirectory', $caseDirectory,
            '-StopTimeoutSeconds', '1', '-StartTimeoutSeconds', '1')
        if ($scenario -eq 'check-only') { $arguments += '-CheckOnly' }
        $heldMutex = $null
        if ($scenario -eq 'overlap') {
            $heldMutex = New-Object System.Threading.Mutex($false, 'Global\PkSystemReset_richy-wine-service')
            if (-not $heldMutex.WaitOne(0)) { throw 'Cannot acquire test mutex.' }
        }
        try {
            $previousErrorPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            try {
                $output = (& powershell.exe @arguments 2>&1 | Out-String)
                $result = $LASTEXITCODE
            } finally { $ErrorActionPreference = $previousErrorPreference }
        } finally {
            if ($heldMutex) { $heldMutex.ReleaseMutex(); $heldMutex.Dispose() }
        }
        $actions = @(Get-Content -LiteralPath (Join-Path $caseDirectory 'actions.txt') | Where-Object { $_ }) -join ','
        $expectedActions = ''
        $expectedResult = 1
        switch ($scenario) {
            'success' { $expectedActions = 'STOP,START'; $expectedResult = 0 }
            'stopped-clean' { $expectedActions = 'START'; $expectedResult = 0 }
            'check-only' { $expectedResult = 0 }
            'overlap' { $expectedResult = 0 }
            'stop-denied' { $expectedActions = 'STOP' }
            'stop-timeout' { $expectedActions = 'STOP' }
            'orphan-after-stop' { $expectedActions = 'STOP' }
            'startup-timeout' { $expectedActions = 'STOP,START' }
        }
        if ($result -ne $expectedResult -or $actions -ne $expectedActions) {
            throw ("Failed ${scenario}: expected ${expectedResult}/${expectedActions}, got ${result}/${actions}. " + $output)
        }
        $expectedLog = 'ERROR:'
        if ($scenario -in @('success', 'stopped-clean')) { $expectedLog = 'SUCCESS:' }
        if ($scenario -eq 'check-only') { $expectedLog = 'CHECK ONLY:' }
        if ($scenario -eq 'overlap') { $expectedLog = 'SKIPPED:' }
        $logs = @(Get-ChildItem -LiteralPath (Join-Path $caseDirectory 'reset-logs') -Filter '*.log')
        if ($logs.Count -ne 1 -or [IO.File]::ReadAllText($logs[0].FullName) -notmatch [regex]::Escape($expectedLog)) {
            throw ('Required result was not logged for ' + $scenario)
        }
        if ($scenario -eq 'success' -and $output -notmatch 'Java PID=5002') { throw 'The new listener was not verified.' }
        Write-Output ('PASS: ' + $scenario)
    }
} finally {
    $tempPrefix = [IO.Path]::GetFullPath($testTempRoot).TrimEnd('\') + '\'
    if (-not $fixtureRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path -Leaf $fixtureRoot) -notmatch '^pk-reset-test-[0-9a-f]{32}$') { throw 'Unexpected cleanup directory.' }
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
}
