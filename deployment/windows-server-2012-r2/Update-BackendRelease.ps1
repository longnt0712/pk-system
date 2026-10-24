[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'settings.json'),
    [switch]$CheckOnly,
    [switch]$RetryFailed
)

# Windows PowerShell 4 / .NET 4.5. The PAT is used only for api.github.com.
$ErrorActionPreference = 'Stop'

function Get-ReleaseSha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose(); $stream.Dispose() }
}

function Read-ReleaseJson([string]$Path) {
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return ([IO.File]::ReadAllText($Path) | ConvertFrom-Json)
    }
    return $null
}

function Write-ReleaseJson([string]$Path, $Value) {
    $temporary = $Path + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
    try {
        [IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
        if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temporary, $Path, $null) }
        else { [IO.File]::Move($temporary, $Path) }
    } finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
}

function Write-ReleaseLog([string]$Message) {
    $line = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ') + ' ' + $Message
    if ($script:releaseLogPath) { Add-Content -LiteralPath $script:releaseLogPath -Value $line -Encoding UTF8 }
    Write-Host $line
}

function Assert-ReleaseAdministrator {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this updater as Administrator or SYSTEM.'
    }
}

function Get-ReleaseToken([string]$Path) {
    Add-Type -AssemblyName System.Security
    $protected = [IO.File]::ReadAllBytes($Path)
    $plain = [Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
    try {
        $token = [Text.Encoding]::UTF8.GetString($plain)
        if ([string]::IsNullOrWhiteSpace($token) -or $token -match '[\r\n]') { throw 'The encrypted GitHub token is empty or invalid.' }
        return $token
    } finally { [Array]::Clear($plain, 0, $plain.Length) }
}

function Assert-ReleaseHttpsUri([Uri]$Uri, [switch]$AssetRedirect) {
    if (-not $Uri.IsAbsoluteUri -or $Uri.Scheme -cne 'https' -or $Uri.Port -ne 443 -or
        $Uri.UserInfo -or $Uri.Fragment) { throw 'GitHub response contained an unsafe URL.' }
    if ($AssetRedirect) {
        if ($Uri.DnsSafeHost -ine 'api.github.com' -and
            $Uri.DnsSafeHost -notmatch '^[A-Za-z0-9.-]+\.githubusercontent\.com$') {
            throw 'GitHub asset redirected to an untrusted download host.'
        }
    } elseif ($Uri.DnsSafeHost -ine 'api.github.com') { throw 'GitHub API requests must use api.github.com.' }
}

function New-ReleaseWebRequest([Uri]$Uri) { return [Net.HttpWebRequest]::Create($Uri) }

function Invoke-ReleaseGitHubRequest {
    param([Uri]$Uri, [string]$Token, [string]$Accept = 'application/vnd.github+json',
        [string]$OutputPath, [long]$MaximumBytes = 4194304, [switch]$Asset)
    Assert-ReleaseHttpsUri $Uri
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $current = $Uri
    $redirects = 0
    while ($true) {
        $request = New-ReleaseWebRequest $current
        $request.Method = 'GET'
        $request.AllowAutoRedirect = $false
        $request.Timeout = 60000
        $request.ReadWriteTimeout = 60000
        $request.UserAgent = 'PK-System-Backend-Release-Updater/1'
        $request.Accept = $Accept
        # Redirects always create a fresh request without Authorization, including
        # redirects back to GitHub. A signed download URL must never receive a PAT.
        if ($redirects -eq 0) { $request.Headers['Authorization'] = 'Bearer ' + $Token }
        $request.Headers['X-GitHub-Api-Version'] = '2022-11-28'
        $response = $null
        try {
            try { $response = $request.GetResponse() }
            catch [Net.WebException] {
                $status = ''
                if ($_.Exception.Response) {
                    $status = ' (HTTP ' + [int]$_.Exception.Response.StatusCode + ')'
                    $_.Exception.Response.Dispose()
                }
                throw ('GitHub request failed' + $status + '. Check token access and connectivity.')
            }
            $statusCode = [int]$response.StatusCode
            if ($statusCode -in @(301, 302, 303, 307, 308)) {
                if (-not $Asset -or $redirects -ge 5) { throw 'Unexpected or excessive GitHub API redirects.' }
                $location = [string]$response.Headers['Location']
                if (-not $location) { throw 'GitHub redirect omitted its download URL.' }
                $next = New-Object Uri($current, $location)
                Assert-ReleaseHttpsUri $next -AssetRedirect
                $current = $next
                $redirects++
                continue
            }
            if ($statusCode -ne 200) { throw ('GitHub returned unexpected HTTP ' + $statusCode + '.') }
            if ($response.ContentLength -gt $MaximumBytes) { throw 'GitHub response exceeds the expected size.' }
            $inputStream = $response.GetResponseStream()
            $outputStream = $null
            try {
                if ($OutputPath) { $outputStream = [IO.File]::Open($OutputPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None) }
                else { $outputStream = New-Object IO.MemoryStream }
                $buffer = New-Object byte[] 65536
                [long]$total = 0
                while (($read = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $total += $read
                    if ($total -gt $MaximumBytes) { throw 'GitHub response exceeds the expected size.' }
                    $outputStream.Write($buffer, 0, $read)
                }
                if (-not $OutputPath) { return [Text.Encoding]::UTF8.GetString($outputStream.ToArray()) }
                return
            } finally {
                if ($outputStream) { $outputStream.Dispose() }
                if ($inputStream) { $inputStream.Dispose() }
            }
        } finally { if ($response) { $response.Dispose() } }
    }
}

function Assert-ReleaseInteger($Value) {
    return ($Value -is [int] -or $Value -is [long] -or $Value -is [short] -or $Value -is [byte])
}

function Get-ReleaseTimestamp($Value) {
    if ($Value -isnot [string] -or $Value -notmatch '^\d{4}-\d{2}-\d{2}T.+Z$') { throw 'Release timestamp must be UTC ISO 8601.' }
    $parsed = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse($Value, [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::AssumeUniversal, [ref]$parsed)) { throw 'Release timestamp is invalid.' }
    return $parsed.UtcDateTime
}

function Assert-ReleaseAsset($Asset, [string]$Repository, [string]$Name) {
    if (-not $Asset -or $Asset.name -cne $Name -or -not (Assert-ReleaseInteger $Asset.id) -or $Asset.id -le 0 -or
        -not (Assert-ReleaseInteger $Asset.size) -or $Asset.size -le 0) { throw ('Release asset metadata is invalid: ' + $Name) }
    $expected = 'https://api.github.com/repos/' + $Repository + '/releases/assets/' + [string]$Asset.id
    if ([string]$Asset.url -cne $expected) { throw ('Release asset API URL does not match the configured repository: ' + $Name) }
    Assert-ReleaseHttpsUri ([Uri]$Asset.url)
}

function Select-BackendRelease($Releases, [string]$Repository) {
    $candidates = @()
    foreach ($release in @($Releases)) {
        if ($release.draft -isnot [bool] -or $release.prerelease -isnot [bool] -or $release.draft -or $release.prerelease -or
            [string]$release.tag_name -cnotmatch '^backend-[A-Za-z0-9._-]+$') { continue }
        $jars = @($release.assets | Where-Object { $_.name -ceq 'richy-wine-exec.jar' })
        $manifests = @($release.assets | Where-Object { $_.name -ceq 'backend-release.json' })
        if ($jars.Count -eq 0 -or $manifests.Count -eq 0) { continue }
        if ($jars.Count -ne 1 -or $manifests.Count -ne 1) { throw 'Release contains duplicate backend assets.' }
        if (-not (Assert-ReleaseInteger $release.id) -or $release.id -le 0) { throw 'Release ID is invalid.' }
        $published = Get-ReleaseTimestamp $release.published_at
        $candidates += [pscustomobject]@{ Release = $release; Jar = $jars[0]; Manifest = $manifests[0]; Published = $published; Id = [long]$release.id }
    }
    $selected = @($candidates | Sort-Object -Property @{Expression='Published'; Descending=$true}, @{Expression='Id'; Descending=$true} | Select-Object -First 1)
    if ($selected.Count -eq 0) { return $null }
    Assert-ReleaseAsset $selected[0].Jar $Repository 'richy-wine-exec.jar'
    Assert-ReleaseAsset $selected[0].Manifest $Repository 'backend-release.json'
    if ($selected[0].Manifest.size -gt 1048576) { throw 'Release manifest is too large.' }
    return $selected[0]
}

function Assert-BackendReleaseManifest($Manifest, $Candidate) {
    $tag = [string]$Candidate.Release.tag_name
    if ($tag -cnotmatch '^backend-\d{8}-\d{6}-[0-9a-f]{8}-[0-9a-f]{8}$' -or
        -not (Assert-ReleaseInteger $Manifest.schemaVersion) -or $Manifest.schemaVersion -ne 1 -or
        $Manifest.tag -cne $tag -or $Manifest.commit -isnot [string] -or $Manifest.commit -cnotmatch '^[0-9a-f]{40}$' -or
        $Manifest.sourceDirty -isnot [bool] -or -not (Assert-ReleaseInteger $Manifest.javaMajor) -or $Manifest.javaMajor -ne 8 -or
        -not $Manifest.jar -or $Manifest.jar.name -cne 'richy-wine-exec.jar' -or
        $Manifest.jar.sha256 -isnot [string] -or $Manifest.jar.sha256 -cnotmatch '^[0-9a-f]{64}$' -or
        -not (Assert-ReleaseInteger $Manifest.jar.bytes) -or $Manifest.jar.bytes -le 0 -or $Manifest.jar.bytes -ne $Candidate.Jar.size) {
        throw 'Release manifest failed schema, tag, Java 8 or JAR metadata validation.'
    }
    if ($tag.Split('-')[3] -cne $Manifest.commit.Substring(0, 8)) { throw 'Release tag does not match the manifest commit.' }
    Get-ReleaseTimestamp $Manifest.builtAtUtc | Out-Null
}

function Read-BackendReleaseConfig([string]$Path) {
    $config = Read-ReleaseJson $Path
    if (-not $config -or $config.repository -cnotmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' -or
        -not $config.expectedComputer -or -not (Assert-ReleaseInteger $config.port) -or $config.port -lt 1 -or $config.port -gt 65535) {
        throw 'Backend release settings are missing or invalid.'
    }
    foreach ($property in @('tokenPath', 'backendDirectory', 'resetScriptPath')) {
        $value = [string]$config.$property
        if (-not [IO.Path]::IsPathRooted($value) -or $value -match '[\r\n\"]') { throw ('Settings require a safe absolute path: ' + $property) }
        $config.$property = [IO.Path]::GetFullPath($value)
    }
    $healthUri = $null
    if (-not [Uri]::TryCreate([string]$config.healthCheckUri, [UriKind]::Absolute, [ref]$healthUri) -or
        $healthUri.Scheme -ne 'http' -or $healthUri.Host -cne '127.0.0.1' -or $healthUri.Port -ne $config.port -or
        $healthUri.UserInfo -or $healthUri.Fragment) { throw 'Health check must use http://127.0.0.1 on the configured backend port.' }
    return $config
}

function Invoke-BackendReleaseReset($Config, [string]$JarPath, [string]$Sha256) {
    $arguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $Config.resetScriptPath,
        '-ExpectedComputer', $Config.expectedComputer, '-BackendDirectory', $Config.backendDirectory,
        '-Port', [string]$Config.port, '-ReplacementJarPath', $JarPath, '-ExpectedSha256', $Sha256,
        '-HealthCheckUri', $Config.healthCheckUri)
    $output = & powershell.exe @arguments 2>&1
    $result = $LASTEXITCODE
    if ($result -ne 75) { foreach ($line in $output) { Write-ReleaseLog ('RESET: ' + [string]$line) } }
    return $result
}

function Invoke-BackendReleaseUpdate([string]$SettingsPath, [switch]$InspectOnly, [switch]$AllowFailedRetry) {
    $mutex = $null
    $locked = $false
    $stageDirectory = $null
    $candidate = $null
    $manifest = $null
    $runtimeDirectory = $null
    $script:releaseLogPath = $null
    try {
        $fullSettingsPath = [IO.Path]::GetFullPath($SettingsPath)
        $config = Read-BackendReleaseConfig $fullSettingsPath
        if ($env:COMPUTERNAME -ine $config.expectedComputer) { throw ('Run this updater on ' + $config.expectedComputer + '.') }
        Assert-ReleaseAdministrator
        $runtimeDirectory = Split-Path -Parent $fullSettingsPath
        if (-not $InspectOnly) { $script:releaseLogPath = Join-Path $runtimeDirectory 'backend-release.log' }
        if (-not (Test-Path -LiteralPath $config.tokenPath -PathType Leaf) -or
            -not (Test-Path -LiteralPath $config.resetScriptPath -PathType Leaf) -or
            -not (Test-Path -LiteralPath $config.backendDirectory -PathType Container)) { throw 'Required token, reset script or backend directory is missing.' }
        $mutex = New-Object Threading.Mutex($false, 'Global\PkSystemBackendReleaseUpdate')
        try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
        if (-not $locked) { return 0 }
        $statePath = Join-Path $runtimeDirectory 'last-deployed.json'
        $failedPath = Join-Path $runtimeDirectory 'failed-release.json'
        $errorPath = Join-Path $runtimeDirectory 'last-error.json'
        $last = Read-ReleaseJson $statePath
        $failed = Read-ReleaseJson $failedPath
        $token = Get-ReleaseToken $config.tokenPath
        try {
            $listUri = [Uri]('https://api.github.com/repos/' + $config.repository + '/releases?per_page=30')
            $releases = (Invoke-ReleaseGitHubRequest -Uri $listUri -Token $token) | ConvertFrom-Json
            $candidate = Select-BackendRelease $releases $config.repository
            if (-not $candidate) {
                if ($InspectOnly) { Write-ReleaseLog 'CHECK ONLY: no published backend release with both required assets was found.' }
                return 0
            }
            $tag = [string]$candidate.Release.tag_name
            if ($last) {
                if ($last.tag -cnotmatch '^backend-[A-Za-z0-9._-]+$' -or $last.sha256 -cnotmatch '^[0-9a-f]{64}$' -or
                    -not (Assert-ReleaseInteger $last.releaseId) -or $last.releaseId -le 0) { throw 'Last-deployed state is invalid; inspect it before continuing.' }
                $lastPublished = Get-ReleaseTimestamp $last.releasePublishedAtUtc
                if ($candidate.Published -lt $lastPublished -or ($candidate.Published -eq $lastPublished -and $candidate.Id -lt $last.releaseId)) {
                    if ($InspectOnly) { Write-ReleaseLog 'CHECK ONLY: available release is older than last-deployed state; automatic downgrade is blocked.' }
                    return 0
                }
            }
            if (-not $InspectOnly -and -not $AllowFailedRetry -and $failed -and $failed.tag -ceq $tag) { return 1 }
            $manifest = (Invoke-ReleaseGitHubRequest -Uri ([Uri]$candidate.Manifest.url) -Token $token -Accept 'application/octet-stream' -Asset -MaximumBytes 1048576) | ConvertFrom-Json
            Assert-BackendReleaseManifest $manifest $candidate
            if ($InspectOnly) {
                $retry = ''
                if ($failed -and $failed.tag -ceq $tag) { $retry = ' This tag previously failed; normal polling will wait for a new tag or -RetryFailed.' }
                Write-ReleaseLog ('CHECK ONLY: validated release ' + $tag + ', Java 8, JAR bytes=' + $manifest.jar.bytes + ', SHA256=' + $manifest.jar.sha256 + '.' + $retry + ' No JAR was downloaded and no deployment was requested.')
                return 0
            }
            $currentJar = Join-Path $config.backendDirectory 'richy-wine-exec.jar'
            $sameHash = (Test-Path -LiteralPath $currentJar -PathType Leaf) -and (Get-ReleaseSha256 $currentJar) -ceq $manifest.jar.sha256
            if (-not $sameHash) {
                $cacheRoot = Join-Path $runtimeDirectory 'cache'
                New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
                $stageDirectory = Join-Path $cacheRoot ([Guid]::NewGuid().ToString('N'))
                New-Item -ItemType Directory -Path $stageDirectory | Out-Null
                $stagedJar = Join-Path $stageDirectory 'richy-wine-exec.jar'
                Invoke-ReleaseGitHubRequest -Uri ([Uri]$candidate.Jar.url) -Token $token -Accept 'application/octet-stream' -Asset -OutputPath $stagedJar -MaximumBytes $manifest.jar.bytes
                if ((Get-Item -LiteralPath $stagedJar).Length -ne $manifest.jar.bytes -or
                    (Get-ReleaseSha256 $stagedJar) -cne $manifest.jar.sha256) { throw 'Downloaded JAR length or SHA256 does not match the release manifest.' }
                $deferredPath = Join-Path $runtimeDirectory 'deferred-release.json'
                $deferred = Read-ReleaseJson $deferredPath
                if (-not $deferred -or $deferred.tag -cne $tag) { Write-ReleaseLog ('DEPLOY: requesting verified backend release ' + $tag + '.') }
                $resetResult = Invoke-BackendReleaseReset $config $stagedJar $manifest.jar.sha256
                if ($resetResult -eq 75) {
                    if (-not $deferred -or $deferred.tag -cne $tag) {
                        Write-ReleaseLog ('DEFERRED: backend reset is busy; release ' + $tag + ' will be retried on the next poll.')
                        Write-ReleaseJson $deferredPath ([ordered]@{ tag=$tag; deferredAtUtc=[DateTime]::UtcNow.ToString('o') })
                    }
                    return 0
                }
                if ($resetResult -ne 0) { throw ('Backend reset/deployment failed or was busy (exit ' + $resetResult + '). No deployed marker was written.') }
                if (-not (Test-Path -LiteralPath $currentJar -PathType Leaf) -or
                    (Get-ReleaseSha256 $currentJar) -cne $manifest.jar.sha256) { throw 'Backend reset returned success but the installed JAR hash does not match.' }
            }
            $stateChanged = -not $last -or $last.tag -cne $tag -or $last.sha256 -cne $manifest.jar.sha256
            if ($stateChanged -or -not $sameHash) {
                Write-ReleaseJson $statePath ([ordered]@{ schemaVersion=1; tag=$tag; sha256=$manifest.jar.sha256; commit=$manifest.commit;
                    deployedAtUtc=[DateTime]::UtcNow.ToString('o'); releasePublishedAtUtc=[string]$candidate.Release.published_at; releaseId=$candidate.Id })
                if ($sameHash) { Write-ReleaseLog ('CURRENT: recorded release ' + $tag + '; installed JAR already has the verified SHA256. No restart requested.') }
                else { Write-ReleaseLog ('SUCCESS: deployed and verified release ' + $tag + '.') }
            }
            foreach ($path in @($failedPath, $errorPath, (Join-Path $runtimeDirectory 'deferred-release.json'))) { if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path -Force } }
            return 0
        } finally { $token = $null }
    } catch {
        $message = $_.Exception.Message
        $tag = $null
        $sha256 = $null
        if ($candidate) { $tag = [string]$candidate.Release.tag_name }
        if ($manifest -and $manifest.jar -and $manifest.jar.sha256 -cmatch '^[0-9a-f]{64}$') { $sha256 = $manifest.jar.sha256 }
        $shouldLog = $true
        if (-not $InspectOnly -and $runtimeDirectory -and $locked) {
            try {
                $previous = Read-ReleaseJson (Join-Path $runtimeDirectory 'last-error.json')
                $shouldLog = -not $previous -or $previous.message -cne $message -or $previous.tag -cne $tag
                $record = [ordered]@{ tag=$tag; sha256=$sha256; failedAtUtc=[DateTime]::UtcNow.ToString('o'); message=$message }
                Write-ReleaseJson (Join-Path $runtimeDirectory 'last-error.json') $record
                if ($candidate) { Write-ReleaseJson (Join-Path $runtimeDirectory 'failed-release.json') $record }
            } catch { $shouldLog = $true }
        }
        if ($shouldLog) { Write-ReleaseLog ('ERROR: ' + $message) }
        return 1
    } finally {
        if ($stageDirectory -and (Test-Path -LiteralPath $stageDirectory -PathType Container)) {
            # Only remove the generated GUID directory, never the configured backend.
            $expectedParent = [IO.Path]::GetFullPath((Join-Path $runtimeDirectory 'cache')).TrimEnd('\')
            $stageFull = [IO.Path]::GetFullPath($stageDirectory)
            if ((Split-Path -Parent $stageFull) -ieq $expectedParent -and (Split-Path -Leaf $stageFull) -match '^[0-9a-f]{32}$') {
                Remove-Item -LiteralPath $stageFull -Recurse -Force
            }
        }
        if ($locked) { $mutex.ReleaseMutex() }
        if ($mutex) { $mutex.Dispose() }
        $script:releaseLogPath = $null
    }
}

exit (Invoke-BackendReleaseUpdate -SettingsPath $ConfigPath -InspectOnly:$CheckOnly -AllowFailedRetry:$RetryFailed)
