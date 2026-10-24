# Offline tests. Import function definitions only; never execute the installer,
# contact GitHub, invoke Reset-RichyService, or inspect/change a Windows service.
$ErrorActionPreference = 'Stop'
$productionDirectory = Split-Path -Parent $PSScriptRoot
$repositoryDirectory = Split-Path -Parent (Split-Path -Parent $productionDirectory)
$temporaryRoot = Join-Path $repositoryDirectory '.tmp'
$fixtureRoot = [IO.Path]::GetFullPath((Join-Path $temporaryRoot ('pk-release-test-' + [Guid]::NewGuid().ToString('N'))))
New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null
$updaterPath = Join-Path $productionDirectory 'Update-BackendRelease.ps1'
$installerPath = Join-Path $productionDirectory 'Install-BackendReleaseTask.ps1'
$tokens = $null
$parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($updaterPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
foreach ($statement in $ast.EndBlock.Statements) {
    if ($statement -is [Management.Automation.Language.FunctionDefinitionAst]) { Invoke-Expression $statement.Extent.Text }
}
$realRequestFunction = (Get-Command Invoke-ReleaseGitHubRequest).ScriptBlock
$installerAst = [Management.Automation.Language.Parser]::ParseFile($installerPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$installerSource = [IO.File]::ReadAllText($installerPath)
$updaterSource = [IO.File]::ReadAllText($updaterPath)

function Assert-Test([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Assert-Throws([scriptblock]$Action, [string]$Message) {
    $threw = $false
    try { & $Action | Out-Null } catch { $threw = $true }
    Assert-Test $threw $Message
}
function Write-Host { param([Parameter(ValueFromRemainingArguments=$true)]$Object) $script:messages += [string]$Object }
function Assert-ReleaseAdministrator { }
function Get-ReleaseToken([string]$Path) { return 'fixture-token-never-use' }
function Invoke-ReleaseGitHubRequest {
    param([Uri]$Uri, [string]$Token, [string]$Accept, [string]$OutputPath, [long]$MaximumBytes, [switch]$Asset)
    $script:requests += $Uri.AbsoluteUri
    if ($Uri.AbsolutePath -like '*/releases') {
        if ($script:scenario -eq 'api-error') { throw 'GitHub request failed (HTTP 403). Check token access and connectivity.' }
        return ($script:releases | ConvertTo-Json -Depth 9 -Compress)
    }
    if ($Uri.AbsolutePath -like '*/assets/12') { return ($script:manifest | ConvertTo-Json -Depth 9 -Compress) }
    if ($Uri.AbsolutePath -like '*/assets/11') {
        Assert-Test ([bool]$OutputPath) 'JAR download must be streamed to a file.'
        [IO.File]::WriteAllBytes($OutputPath, $script:newJar)
        if ($script:scenario -eq 'bad-download') { [IO.File]::AppendAllText($OutputPath, 'corrupt') }
        return
    }
    throw 'Unexpected mock GitHub URL.'
}
function Invoke-BackendReleaseReset($Config, [string]$JarPath, [string]$Sha256) {
    $script:resetCount++
    Assert-Test ((Get-ReleaseSha256 $JarPath) -ceq $script:manifest.jar.sha256) 'Reset received an unverified JAR.'
    if ($script:scenario -eq 'reset-failure') { return 1 }
    if ($script:scenario -eq 'reset-busy') { return 75 }
    if ($script:scenario -ne 'reset-false-success') { Copy-Item -LiteralPath $JarPath -Destination (Join-Path $Config.backendDirectory 'richy-wine-exec.jar') -Force }
    return 0
}

try {
    $cases = @('success', 'check-only', 'same-hash', 'same-tag', 'older-release', 'failed-tag', 'retry-failed',
        'new-after-failure', 'reset-failure', 'reset-false-success', 'reset-busy', 'bad-download', 'bad-hash',
        'bad-bytes', 'bad-java', 'bad-commit', 'bad-tag', 'bad-schema', 'bad-dirty', 'bad-time', 'bad-asset-url',
        'duplicate-assets', 'missing-asset', 'draft-release', 'prerelease', 'no-releases', 'api-error')
    foreach ($case in $cases) {
        $script:scenario = $case
        $script:messages = @()
        $script:requests = @()
        $script:resetCount = 0
        $directory = Join-Path $fixtureRoot $case
        $backend = Join-Path $directory 'backend'
        New-Item -ItemType Directory -Path $backend -Force | Out-Null
        $currentJar = Join-Path $backend 'richy-wine-exec.jar'
        [IO.File]::WriteAllText($currentJar, 'old backend')
        [IO.File]::WriteAllText((Join-Path $directory 'github-token.bin'), 'dummy fixture only')
        [IO.File]::WriteAllText((Join-Path $directory 'Reset-RichyService.ps1'), '# never executed')
        $script:newJar = [Text.Encoding]::UTF8.GetBytes('verified backend fixture')
        $newPath = Join-Path $directory 'new.jar'
        [IO.File]::WriteAllBytes($newPath, $script:newJar)
        $hash = Get-ReleaseSha256 $newPath
        $tag = 'backend-20261025-100000-aaaaaaaa-1234abcd'
        $script:manifest = [pscustomobject]@{ schemaVersion=1; tag=$tag; commit=('a' * 40); sourceDirty=$false;
            builtAtUtc='2026-10-25T10:00:00Z'; javaMajor=8; jar=[pscustomobject]@{name='richy-wine-exec.jar'; sha256=$hash; bytes=$script:newJar.Length} }
        $jarAsset = [pscustomobject]@{name='richy-wine-exec.jar'; id=11; size=$script:newJar.Length; url='https://api.github.com/repos/owner/repo/releases/assets/11'}
        $manifestAsset = [pscustomobject]@{name='backend-release.json'; id=12; size=400; url='https://api.github.com/repos/owner/repo/releases/assets/12'}
        $release = [pscustomobject]@{id=100; tag_name=$tag; published_at='2026-10-25T10:01:00Z'; draft=$false; prerelease=$false; assets=@($jarAsset, $manifestAsset)}
        $script:releases = @($release)
        $settings = Join-Path $directory 'settings.json'
        Write-ReleaseJson $settings ([ordered]@{repository='owner/repo'; expectedComputer=$env:COMPUTERNAME; tokenPath=(Join-Path $directory 'github-token.bin');
            resetScriptPath=(Join-Path $directory 'Reset-RichyService.ps1'); backendDirectory=$backend; port=8085; healthCheckUri='http://127.0.0.1:8085/service/api/topic/get_one/1'})
        $lastPath = Join-Path $directory 'last-deployed.json'
        $failedPath = Join-Path $directory 'failed-release.json'
        $last = [ordered]@{tag=$tag; sha256=$hash; releaseId=100; releasePublishedAtUtc=$release.published_at}
        switch ($case) {
            'same-hash' { Copy-Item -LiteralPath $newPath -Destination $currentJar -Force }
            'same-tag' { Copy-Item -LiteralPath $newPath -Destination $currentJar -Force; Write-ReleaseJson $lastPath $last }
            'older-release' { $last.releasePublishedAtUtc='2026-10-26T10:00:00Z'; $last.releaseId=101; Write-ReleaseJson $lastPath $last }
            'failed-tag' { Write-ReleaseJson $failedPath @{tag=$tag; sha256=$hash} }
            'retry-failed' { Write-ReleaseJson $failedPath @{tag=$tag; sha256=$hash} }
            'new-after-failure' { Write-ReleaseJson $failedPath @{tag='backend-20261024-100000-aaaaaaaa-9876abcd'; sha256=$hash} }
            'bad-hash' { $script:manifest.jar.sha256='A' * 64 }
            'bad-bytes' { $script:manifest.jar.bytes++ }
            'bad-java' { $script:manifest.javaMajor=17 }
            'bad-commit' { $script:manifest.commit='b' * 40 }
            'bad-tag' { $script:manifest.tag='backend-other' }
            'bad-schema' { $script:manifest.schemaVersion='1' }
            'bad-dirty' { $script:manifest.sourceDirty='false' }
            'bad-time' { $script:manifest.builtAtUtc='not-a-date' }
            'bad-asset-url' { $jarAsset.url='https://api.github.com/repos/attacker/repo/releases/assets/11' }
            'duplicate-assets' { $release.assets=@($jarAsset, $jarAsset, $manifestAsset) }
            'missing-asset' { $release.assets=@($jarAsset) }
            'draft-release' { $release.draft=$true }
            'prerelease' { $release.prerelease=$true }
            'no-releases' { $script:releases=@() }
        }
        $result = Invoke-BackendReleaseUpdate -SettingsPath $settings -InspectOnly:($case -eq 'check-only') -AllowFailedRetry:($case -eq 'retry-failed')
        $expectedResult = 1
        $expectedResets = 0
        $expectedState = $false
        if ($case -in @('success', 'same-hash', 'same-tag', 'retry-failed', 'new-after-failure')) { $expectedResult=0; $expectedState=$true }
        if ($case -in @('success', 'retry-failed', 'new-after-failure', 'reset-failure', 'reset-false-success', 'reset-busy')) { $expectedResets=1 }
        if ($case -in @('check-only', 'older-release', 'reset-busy', 'missing-asset', 'draft-release', 'prerelease', 'no-releases')) { $expectedResult=0 }
        if ($case -eq 'older-release') { $expectedState=$true }
        Assert-Test ($result -eq $expectedResult) ("${case}: expected exit $expectedResult, got $result. " + ($script:messages -join '; '))
        Assert-Test ($script:resetCount -eq $expectedResets) ("${case}: wrong reset count.")
        Assert-Test ((Test-Path -LiteralPath $lastPath) -eq $expectedState) ("${case}: deployed marker was not written safely.")
        if ($case -in @('success', 'same-hash', 'retry-failed', 'new-after-failure')) {
            Assert-Test ((Get-ReleaseSha256 $currentJar) -ceq $hash) ("${case}: installed JAR hash differs.")
        }
        if ($case -eq 'check-only') {
            Assert-Test ($script:requests.Count -eq 2) 'CheckOnly must inspect metadata/manifest without downloading the JAR.'
            Assert-Test (-not (Test-Path -LiteralPath (Join-Path $directory 'cache'))) 'CheckOnly created a staging directory.'
            Assert-Test (-not (Test-Path -LiteralPath (Join-Path $directory 'backend-release.log'))) 'CheckOnly mutated runtime logs.'
        }
        if ($case -eq 'reset-busy') {
            Assert-Test (-not (Test-Path -LiteralPath $failedPath)) 'Busy reset was permanently marked as a failed release.'
            $beforeMessages = $script:messages.Count
            $second = Invoke-BackendReleaseUpdate -SettingsPath $settings
            Assert-Test ($second -eq 0 -and $script:resetCount -eq 2) 'Busy reset was not retried on the next poll.'
            Assert-Test ($script:messages.Count -eq $beforeMessages) 'Unchanged busy release repeated log messages.'
        }
        if ($case -in @('reset-failure', 'reset-false-success', 'bad-download', 'bad-java')) {
            Assert-Test (Test-Path -LiteralPath $failedPath) ("${case}: missing failure marker.")
            $beforeRequests = $script:requests.Count
            $beforeMessages = $script:messages.Count
            $second = Invoke-BackendReleaseUpdate -SettingsPath $settings
            Assert-Test ($second -eq 1 -and $script:requests.Count -eq ($beforeRequests + 1)) ("${case}: failed tag was downloaded or deployed again.")
            Assert-Test ($script:messages.Count -eq $beforeMessages) ("${case}: repeated failure was logged again.")
        }
        if ($case -eq 'api-error') {
            $beforeMessages = $script:messages.Count
            $second = Invoke-BackendReleaseUpdate -SettingsPath $settings
            Assert-Test ($second -eq 1 -and $script:messages.Count -eq $beforeMessages) 'Repeated API failure was logged every poll.'
        }
        if ($case -eq 'same-tag') { Assert-Test ($script:messages.Count -eq 0) 'Unchanged deployed release generated logs.' }
        Assert-Test (-not (($script:messages -join ';') -match 'fixture-token-never-use')) 'A token was logged.'
        Write-Output ('PASS: updater ' + $case)
    }

    # Exercise the real HTTP/streaming implementation with fake response streams.
    Set-Item Function:\Invoke-ReleaseGitHubRequest $realRequestFunction
    function New-ReleaseWebRequest([Uri]$Uri) {
        $response = $script:responses[$script:requestObjects.Count]
        $request = [pscustomobject]@{Uri=$Uri; Method=''; AllowAutoRedirect=$true; Timeout=0; ReadWriteTimeout=0; UserAgent=''; Accept=''; Headers=@{}; MockResponse=$response}
        $request | Add-Member ScriptMethod GetResponse { return $this.MockResponse }
        $script:requestObjects += $request
        return $request
    }
    function New-MockResponse([int]$Code, [string]$Location, [string]$Body) {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Body)
        $response = [pscustomobject]@{StatusCode=$Code; Headers=@{Location=$Location}; ContentLength=$bytes.Length; Body=$bytes}
        $response | Add-Member ScriptMethod GetResponseStream { return (New-Object IO.MemoryStream(,$this.Body)) }
        $response | Add-Member ScriptMethod Dispose { }
        return $response
    }
    foreach ($hostName in @('release-assets.githubusercontent.com', 'objects.githubusercontent.com', 'github-cloud.githubusercontent.com')) {
        $script:requestObjects = @()
        $script:responses = @((New-MockResponse 302 ('https://' + $hostName + '/signed?secret=fixture') ''), (New-MockResponse 200 '' 'downloaded'))
        $body = Invoke-ReleaseGitHubRequest -Uri ([Uri]'https://api.github.com/repos/owner/repo/releases/assets/11') -Token 'fixture-secret' -Asset -MaximumBytes 100
        Assert-Test ($body -ceq 'downloaded') 'Asset response stream was not read.'
        Assert-Test ($script:requestObjects[0].Headers.Authorization -ceq 'Bearer fixture-secret') 'Initial asset API request was not authenticated.'
        Assert-Test (-not $script:requestObjects[1].Headers.ContainsKey('Authorization')) 'Authorization leaked to the asset redirect host.'
        Assert-Test (-not $script:requestObjects[0].AllowAutoRedirect) 'Automatic redirects can leak authentication.'
        Write-Output ('PASS: authenticated asset redirect ' + $hostName)
    }
    foreach ($location in @('http://release-assets.githubusercontent.com/file', 'https://evil.example/file', 'https://objects.githubusercontent.com.evil.example/file', 'https://user@objects.githubusercontent.com/file', 'https://objects.githubusercontent.com:444/file')) {
        $script:requestObjects = @()
        $script:responses = @((New-MockResponse 302 $location ''))
        Assert-Throws { Invoke-ReleaseGitHubRequest -Uri ([Uri]'https://api.github.com/repos/owner/repo/releases/assets/11') -Token 'fixture-secret' -Asset } ('Unsafe redirect was accepted: ' + $location)
        Assert-Test ($script:requestObjects.Count -eq 1) 'Unsafe redirect was requested.'
    }
    $script:requestObjects = @()
    $script:responses = @((New-MockResponse 200 '' 'oversize'))
    Assert-Throws { Invoke-ReleaseGitHubRequest -Uri ([Uri]'https://api.github.com/repos/owner/repo/releases/assets/11') -Token 'fixture-secret' -Asset -MaximumBytes 2 } 'Oversized asset response was accepted.'
    Assert-Throws { Assert-ReleaseAsset ([pscustomobject]@{name='x'; id=12; size=10; url='https://api.github.com/repos/owner/repo/releases/assets/12?leak=yes'}) 'owner/repo' 'x' } 'Asset API query was accepted.'
    Assert-Throws { Assert-ReleaseHttpsUri ([Uri]'https://api.github.com.evil.example/repos/owner/repo') } 'Non-GitHub API host was accepted.'
    Write-Output 'PASS: unsafe redirects, asset URLs and oversize responses rejected'

    # Multiple complete releases: select by publication time and ignore a newer draft.
    $release.draft=$false; $release.prerelease=$false; $release.assets=@($jarAsset, $manifestAsset)
    $jarAsset.url='https://api.github.com/repos/owner/repo/releases/assets/11'
    $older = [pscustomobject]@{id=90; tag_name='backend-20261024-100000-aaaaaaaa-1234abcd'; published_at='2026-10-24T10:01:00Z'; draft=$false; prerelease=$false; assets=@($jarAsset, $manifestAsset)}
    $newDraft = [pscustomobject]@{id=110; tag_name='backend-20261026-100000-aaaaaaaa-1234abcd'; published_at='2026-10-26T10:01:00Z'; draft=$true; prerelease=$false; assets=@($jarAsset, $manifestAsset)}
    $selected = Select-BackendRelease @($older, $newDraft, $release) 'owner/repo'
    Assert-Test ($selected.Id -eq 100) 'Latest complete published release was not selected.'
    Assert-Test ($installerSource.Contains('<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>') -and $installerSource.Contains('<Interval>PT1M</Interval>') -and $installerSource.Contains('<UserId>S-1-5-18</UserId>')) 'Installer task is not SYSTEM / once per minute / IgnoreNew.'
    Assert-Test ($installerSource -notmatch 'Start-ScheduledTask|schtasks.+/Run') 'Installer immediately ran deployment.'
    Assert-Test ($installerSource.Contains('DataProtectionScope]::LocalMachine') -and $installerSource.Contains("Read-Host 'GitHub")) 'Installer does not use machine DPAPI / secure token prompt.'
    Assert-Test ($installerSource.IndexOf('Test-BackendReleaseRepository $Repository $plainToken') -lt $installerSource.IndexOf('[IO.File]::WriteAllBytes($tokenPath')) 'Installer overwrites the token before validating replacement credentials.'
    Assert-Test ($updaterSource.Contains("'Global\PkSystemBackendReleaseUpdate'")) 'Updater mutex is missing.'
    Write-Output 'PASS: release ordering and installer safeguards'
} finally {
    $expectedParent = [IO.Path]::GetFullPath($temporaryRoot).TrimEnd('\')
    if ((Split-Path -Parent $fixtureRoot) -ine $expectedParent -or (Split-Path -Leaf $fixtureRoot) -notmatch '^pk-release-test-[0-9a-f]{32}$') { throw 'Unexpected test cleanup directory.' }
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
}
