[CmdletBinding()]
param(
    [string]$RepositoryRoot,
    [string]$JavaHome,
    [string]$MavenHome,
    [string]$MavenExecutable,
    [string]$EclipsePluginDirectory,
    [string]$ReleaseRepository,
    [string]$OutputDirectory,
    [switch]$Offline,
    [switch]$SkipBuild,
    [string]$JarPath,
    [switch]$Publish,
    [switch]$CheckOnly
)

# Local packaging is the default. Only -Publish writes to GitHub. This script
# never connects to the Windows server or starts/stops a backend process.
$ErrorActionPreference = 'Stop'
$backendPublisherScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-BackendCommand([string]$Name) {
    $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    return $null
}

function Invoke-BackendNative([string]$Executable, [string[]]$Arguments) {
    # Invoke .exe/.cmd/.bat paths with the call operator and discrete arguments.
    # Never evaluate a command string or expose captured GitHub/auth output.
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $lines = @(& $Executable @Arguments 2>&1 | ForEach-Object { [string]$_ })
        $nativeExitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $savedPreference }
    return [pscustomobject]@{ ExitCode = $nativeExitCode; Output = $lines }
}

function Get-BackendJava([string]$RequestedHome) {
    $selectedHome = $RequestedHome
    if (-not $selectedHome) { $selectedHome = $env:JAVA_HOME }
    if (-not $selectedHome) {
        $compiler = Resolve-BackendCommand 'javac.exe'
        if ($compiler) { $selectedHome = Split-Path -Parent (Split-Path -Parent $compiler) }
    }
    if (-not $selectedHome) { throw 'Install a Java 8 JDK and pass -JavaHome to its folder (the folder containing bin\java.exe and bin\javac.exe).' }
    $selectedHome = [IO.Path]::GetFullPath($selectedHome)
    $java = Join-Path $selectedHome 'bin\java.exe'
    $javac = Join-Path $selectedHome 'bin\javac.exe'
    if (-not (Test-Path -LiteralPath $java -PathType Leaf) -or -not (Test-Path -LiteralPath $javac -PathType Leaf)) {
        throw 'JavaHome must contain a complete Java 8 JDK, including bin\java.exe and bin\javac.exe.'
    }
    foreach ($tool in @($java, $javac)) {
        $probe = Invoke-BackendNative $tool @('-version')
        if ($probe.ExitCode -ne 0 -or ($probe.Output -join "`n") -notmatch '(?m)(?:java|openjdk|javac)(?: version)?\s+"?1\.8\.') {
            throw 'Both java and javac must be Java 8. A newer JDK is not supported for this legacy Spring Boot build; select -JavaHome explicitly.'
        }
    }
    return [pscustomobject]@{ Home = $selectedHome; Java = $java; Javac = $javac }
}

function Get-BackendNewestFile([string]$Directory, [string]$Filter) {
    if (-not (Test-Path -LiteralPath $Directory -PathType Container)) { return $null }
    return Get-ChildItem -LiteralPath $Directory -Filter $Filter -File |
        Sort-Object LastWriteTimeUtc, Name -Descending | Select-Object -First 1
}

function Get-BackendMaven([string]$Root, $Java, [string]$RequestedHome, [string]$RequestedExecutable, [string]$PluginDirectory) {
    $executable = $RequestedExecutable
    if ($executable) {
        if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw 'MavenExecutable does not exist. Supply the full path to mvn.cmd.' }
        $executable = [IO.Path]::GetFullPath($executable)
    } elseif ($RequestedHome) {
        $executable = Join-Path $RequestedHome 'bin\mvn.cmd'
        if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw 'MavenHome must contain bin\mvn.cmd.' }
        $executable = [IO.Path]::GetFullPath($executable)
    } else {
        $executable = Resolve-BackendCommand 'mvn.cmd'
        if (-not $executable) { $executable = Resolve-BackendCommand 'mvn' }
    }
    if ($executable) {
        $result = [pscustomobject]@{ Executable = $executable; Prefix = @(); Description = $executable }
    } else {
        # m2e's Maven runtime uses several shared Eclipse/cache JARs. Discover
        # their filenames rather than baking this machine's library versions in.
        $pluginDirectories = @()
        if ($PluginDirectory) {
            if (-not (Test-Path -LiteralPath $PluginDirectory -PathType Container)) { throw 'EclipsePluginDirectory does not exist.' }
            $pluginDirectories += [IO.Path]::GetFullPath($PluginDirectory)
        } else {
            $eclipseParents = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:USERPROFILE, ($env:SystemDrive + '\')) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
            foreach ($parent in $eclipseParents) {
                foreach ($folder in @(Get-ChildItem -LiteralPath $parent -Directory -Filter '*eclipse*' -ErrorAction SilentlyContinue)) {
                    foreach ($candidate in @((Join-Path $folder.FullName 'plugins'), (Join-Path $folder.FullName 'eclipse\plugins'))) {
                        if (Test-Path -LiteralPath $candidate -PathType Container) { $pluginDirectories += $candidate }
                    }
                }
            }
        }
        $runtime = $null
        $plugins = $null
        foreach ($directory in @($pluginDirectories | Select-Object -Unique)) {
            $candidateRuntime = Get-ChildItem -LiteralPath $directory -Directory -Filter 'org.eclipse.m2e.maven.runtime_*' |
                Where-Object { @(Get-ChildItem -LiteralPath (Join-Path $_.FullName 'jars') -Filter 'maven-embedder-*.jar' -File -ErrorAction SilentlyContinue).Count -gt 0 } |
                Sort-Object Name -Descending | Select-Object -First 1
            if ($candidateRuntime) { $runtime = $candidateRuntime; $plugins = $directory; break }
        }
        if (-not $runtime) {
            throw 'Maven was not found. Install Apache Maven 3.9.x separately, then pass -MavenHome or -MavenExecutable, or pass -EclipsePluginDirectory to a trusted Eclipse plugins folder. No software was installed.'
        }
        $classpath = @($runtime.FullName, (Join-Path $runtime.FullName 'jars\*'))
        foreach ($pattern in @('org.apache.commons.cli_*.jar', 'org.apache.commons.commons-codec_*.jar', 'org.apache.commons.commons-io_*.jar', 'org.apache.commons.lang3_*.jar')) {
            $library = Get-BackendNewestFile $plugins $pattern
            if (-not $library) { throw 'The embedded Eclipse Maven runtime is incomplete. Use a standalone Maven 3.9.x installation via -MavenHome.' }
            $classpath += $library.FullName
        }
        $slf4j = Get-BackendNewestFile $plugins 'slf4j.api_1.7*.jar'
        if (-not $slf4j) {
            $slf4jRoot = Join-Path $env:USERPROFILE '.m2\repository\org\slf4j\slf4j-api'
            if (Test-Path -LiteralPath $slf4jRoot) {
                foreach ($version in @(Get-ChildItem -LiteralPath $slf4jRoot -Directory -Filter '1.7.*' | Sort-Object { [version]$_.Name } -Descending)) {
                    $slf4j = Get-BackendNewestFile $version.FullName ('slf4j-api-' + $version.Name + '.jar')
                    if ($slf4j) { break }
                }
            }
        }
        $inject = $null
        $injectRoot = Join-Path $env:USERPROFILE '.m2\repository\javax\inject\javax.inject'
        if (Test-Path -LiteralPath $injectRoot) {
            foreach ($version in @(Get-ChildItem -LiteralPath $injectRoot -Directory | Sort-Object Name -Descending)) {
                $inject = Get-BackendNewestFile $version.FullName ('javax.inject-' + $version.Name + '.jar')
                if ($inject) { break }
            }
        }
        if (-not $inject) { $inject = Get-BackendNewestFile $plugins 'jakarta.inject.jakarta.inject-api_1.*.jar' }
        if (-not $slf4j -or -not $inject) { throw 'Eclipse Maven needs SLF4J 1.7 and javax.inject locally. Use a standalone Maven 3.9.x installation via -MavenHome; this script does not download or install tools.' }
        $classpath += @($slf4j.FullName, $inject.FullName)
        $result = [pscustomobject]@{
            Executable = $Java.Java
            Prefix = @('-Dfile.encoding=UTF-8', ('-Dmaven.multiModuleProjectDirectory=' + $Root), '-cp', ($classpath -join ';'), 'org.apache.maven.cli.MavenCli')
            Description = ('Eclipse embedded Maven: ' + $runtime.FullName)
        }
    }
    $probe = Invoke-BackendNative $result.Executable (@($result.Prefix) + @('-version'))
    if ($probe.ExitCode -ne 0 -or ($probe.Output -join "`n") -notmatch 'Apache Maven 3\.') {
        throw 'Maven could not run under the selected Java 8 JDK. Use a compatible standalone Maven 3.9.x with -MavenHome or -MavenExecutable.'
    }
    return $result
}

function Get-BackendGitHubRepository([string]$Remote) {
    $remoteText = $Remote.Trim()
    if ($remoteText -match '^git@github\.com:([A-Za-z0-9-]+/[A-Za-z0-9_.-]+?)(?:\.git)?/?$') { return $Matches[1] }
    $uri = $null
    if ([Uri]::TryCreate($remoteText, [UriKind]::Absolute, [ref]$uri) -and $uri.Host -ieq 'github.com' -and $uri.Scheme -in @('https', 'ssh')) {
        $repository = $uri.AbsolutePath.Trim('/') -replace '\.git$', ''
        if ($repository -match '^[A-Za-z0-9-]+/[A-Za-z0-9_.-]+$') { return $repository }
    }
    return $null
}

function Assert-BackendPrivateRepository([string]$Gh, [string]$Repository) {
    $privacy = Invoke-BackendNative $Gh @('api', '--hostname', 'github.com', ('repos/' + $Repository), '--jq', '.private')
    if ($privacy.ExitCode -ne 0) { throw 'GitHub repository access failed. Check gh authentication and access to the selected private repository. Captured API output was suppressed.' }
    if (($privacy.Output -join "`n").Trim() -cne 'true') { throw 'Publication requires a PRIVATE GitHub repository because this legacy backend JAR can contain application configuration. No release was uploaded.' }
}

function Assert-BackendClassVersion($Entry) {
    $stream = $Entry.Open()
    try {
        $header = New-Object byte[] 8
        if ($stream.Read($header, 0, 8) -ne 8 -or ($header[0..3] -join ',') -ne '202,254,186,190') { throw 'The backend contains an invalid Java class.' }
        $major = ([int]$header[6] * 256) + [int]$header[7]
        if ($major -gt 52) { throw 'The backend contains application classes requiring a Java version newer than Java 8. Rebuild with a Java 8 JDK.' }
    } finally { $stream.Dispose() }
}

function Test-BackendExecutableJar([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'The expected executable backend JAR is missing. A previous build is not used after a failed build.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Add-Type -AssemblyName System.IO.Compression
    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $launcher = $archive.GetEntry('org/springframework/boot/loader/JarLauncher.class')
        $application = $archive.GetEntry('BOOT-INF/classes/com/globits/richy/RichyApplication.class')
        $manifest = $archive.GetEntry('META-INF/MANIFEST.MF')
        $core = @($archive.Entries | Where-Object { $_.FullName -match '^BOOT-INF/lib/core-api-[^/]+\.jar$' })
        $richy = @($archive.Entries | Where-Object { $_.FullName -match '^BOOT-INF/lib/richy-api-[^/]+\.jar$' })
        if (-not $launcher -or -not $application -or -not $manifest -or $core.Count -ne 1 -or $richy.Count -ne 1) { throw 'The file is not the complete richy-wine-exec.jar (Boot launcher, RichyApplication, core-api and richy-api are required).' }
        $reader = New-Object IO.StreamReader($manifest.Open())
        try { $manifestText = $reader.ReadToEnd() -replace '\r?\n ', '' } finally { $reader.Dispose() }
        if ($manifestText -notmatch '(?m)^Main-Class: org\.springframework\.boot\.loader\.JarLauncher\r?$' -or
            $manifestText -notmatch '(?m)^Start-Class: com\.globits\.richy\.RichyApplication\r?$') { throw 'The JAR manifest does not identify the expected executable backend.' }
        Assert-BackendClassVersion $launcher
        foreach ($entry in @($archive.Entries | Where-Object { $_.FullName -match '^BOOT-INF/classes/.+\.class$' })) { Assert-BackendClassVersion $entry }
        foreach ($library in @($core[0], $richy[0])) {
            $buffer = New-Object IO.MemoryStream
            $input = $library.Open()
            try { $input.CopyTo($buffer) } finally { $input.Dispose() }
            $buffer.Position = 0
            $nested = New-Object IO.Compression.ZipArchive($buffer, [IO.Compression.ZipArchiveMode]::Read)
            try { foreach ($entry in @($nested.Entries | Where-Object { $_.FullName -match '\.class$' })) { Assert-BackendClassVersion $entry } }
            finally { $nested.Dispose(); $buffer.Dispose() }
        }
    } finally { $archive.Dispose() }
}

function Write-BackendUtf8([string]$Path, [string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding($false)))
}

function Invoke-BackendPublisher([hashtable]$Options) {
    $settings = @{
        RepositoryRoot = (Join-Path $backendPublisherScriptDirectory '..\..'); JavaHome = ''; MavenHome = ''; MavenExecutable = ''
        EclipsePluginDirectory = ''; ReleaseRepository = ''; OutputDirectory = ''; Offline = $false; SkipBuild = $false
        JarPath = ''; Publish = $false; CheckOnly = $false
    }
    foreach ($key in $Options.Keys) { $settings[$key] = $Options[$key] }
    if (-not $settings.RepositoryRoot) { $settings.RepositoryRoot = Join-Path $backendPublisherScriptDirectory '..\..' }
    $root = [IO.Path]::GetFullPath($settings.RepositoryRoot)
    foreach ($pom in @('core\pom.xml', 'core\core-api\pom.xml', 'richy\pom.xml', 'richy\richy-app\pom.xml')) {
        if (-not (Test-Path -LiteralPath (Join-Path $root $pom) -PathType Leaf)) { throw 'RepositoryRoot must be the pk-system checkout containing both core and richy Maven projects.' }
    }
    if ($settings.SkipBuild -and -not $settings.JarPath) { throw '-SkipBuild requires an explicit -JarPath to an already built executable JAR.' }
    if (-not $settings.SkipBuild -and $settings.JarPath) { throw '-JarPath is only used with -SkipBuild. Omit it to build the current checkout.' }
    $git = Resolve-BackendCommand 'git.exe'
    if (-not $git) { throw 'Git is required to record the source commit. Install Git for Windows and reopen the terminal.' }
    $head = Invoke-BackendNative $git @('-C', $root, 'rev-parse', '--verify', 'HEAD')
    $commit = ($head.Output -join "`n").Trim()
    if ($head.ExitCode -ne 0 -or $commit -notmatch '^[0-9a-fA-F]{40}$') { throw 'Cannot determine a full 40-character source Git commit.' }
    $commit = $commit.ToLowerInvariant()
    $status = Invoke-BackendNative $git @('-C', $root, 'status', '--porcelain', '--untracked-files=normal')
    if ($status.ExitCode -ne 0) { throw 'Cannot determine whether the source checkout has uncommitted changes.' }
    $sourceDirty = -not [string]::IsNullOrWhiteSpace(($status.Output -join "`n"))
    $origin = Invoke-BackendNative $git @('-C', $root, 'remote', 'get-url', 'origin')
    $sourceRepository = $null
    if ($origin.ExitCode -eq 0) { $sourceRepository = Get-BackendGitHubRepository ($origin.Output -join "`n") }
    $releaseRepo = $settings.ReleaseRepository
    if (-not $releaseRepo) { $releaseRepo = $sourceRepository }
    if ($releaseRepo -and $releaseRepo -notmatch '^[A-Za-z0-9-]+/[A-Za-z0-9_.-]+$') { throw 'ReleaseRepository must have the form owner/repository on github.com.' }
    $gh = $null
    if ($settings.Publish) {
        if (-not $releaseRepo) { throw 'Cannot infer a GitHub origin. Supply -ReleaseRepository owner/repository for the private release repository.' }
        $gh = Resolve-BackendCommand 'gh.exe'
        if (-not $gh) { throw 'Publishing requires GitHub CLI (gh). Install it separately, run gh auth login, then retry. Local packaging does not require gh.' }
        $auth = Invoke-BackendNative $gh @('auth', 'status', '--hostname', 'github.com')
        if ($auth.ExitCode -ne 0) { throw 'GitHub CLI is not authenticated for github.com. Run gh auth login with access to the private release repository, then retry. Authentication output was suppressed.' }
        Assert-BackendPrivateRepository $gh $releaseRepo
    }
    $java = Get-BackendJava $settings.JavaHome
    $previousJavaHome = $env:JAVA_HOME
    $previousPath = $env:PATH
    $buildLines = @()
    try {
        $env:JAVA_HOME = $java.Home
        $env:PATH = (Join-Path $java.Home 'bin') + ';' + $previousPath
        $maven = $null
        if (-not $settings.SkipBuild) { $maven = Get-BackendMaven $root $java $settings.MavenHome $settings.MavenExecutable $settings.EclipsePluginDirectory }
        Write-Host ('Source commit: ' + $commit + '; sourceDirty: ' + $sourceDirty)
        Write-Host ('Java 8 JDK: ' + $java.Home)
        if ($maven) { Write-Host ('Maven: ' + $maven.Description) }
        if ($settings.CheckOnly) {
            if ($settings.SkipBuild) { Test-BackendExecutableJar ([IO.Path]::GetFullPath($settings.JarPath)); Write-Host 'Existing executable JAR validation passed.' }
            if ($settings.Publish) { Write-Host ('Private release repository verified: ' + $releaseRepo) }
            else { Write-Host 'Local mode: publishing additionally requires gh auth login and access to a private GitHub repository.' }
            Write-Host 'Preflight passed. No build, package copy or release upload was performed.'
            return
        }
        if (-not $settings.SkipBuild) {
            Write-Host 'Building core-api first, then richy-api and richy-app. Legacy Maven tests are skipped; packaging is not a functional test.'
            $stages = @(
                @{ Name = 'core-api'; Arguments = @('-B', '-f', (Join-Path $root 'core\pom.xml'), '-pl', 'core-api', '-am', '-Dmaven.test.skip=true', 'clean', 'install') },
                @{ Name = 'richy'; Arguments = @('-B', '-f', (Join-Path $root 'richy\pom.xml'), '-Dmaven.test.skip=true', 'clean', 'package') }
            )
            foreach ($stage in $stages) {
                $arguments = @($maven.Prefix) + @($stage.Arguments)
                if ($settings.Offline) { $arguments += '-o' }
                Write-Host ('Building ' + $stage.Name + '...')
                $build = Invoke-BackendNative $maven.Executable $arguments
                $buildLines += @('Build stage: ' + $stage.Name) + @($build.Output)
                if ($build.ExitCode -ne 0) {
                    $failureDirectory = Join-Path $root 'richy\richy-app\target'
                    New-Item -ItemType Directory -Path $failureDirectory -Force | Out-Null
                    $failureLog = Join-Path $failureDirectory ('backend-build-failed-' + [Guid]::NewGuid().ToString('N') + '.log')
                    Write-BackendUtf8 $failureLog ($buildLines -join [Environment]::NewLine)
                    throw ('Maven build failed at ' + $stage.Name + '. Nothing was published and an existing JAR was not used. Local log: ' + $failureLog + '. The legacy POMs use HTTP Central: configure an HTTPS Central mirror in Maven settings if dependency resolution fails. -Offline works only with a complete local dependency/plugin cache. Do not bypass the core-api build or substitute stale cached core-api.')
                }
            }
            $selectedJar = Join-Path $root 'richy\richy-app\target\richy-wine-exec.jar'
        } else { $selectedJar = [IO.Path]::GetFullPath($settings.JarPath) }
        Test-BackendExecutableJar $selectedJar
        $finalHead = Invoke-BackendNative $git @('-C', $root, 'rev-parse', '--verify', 'HEAD')
        if ($finalHead.ExitCode -ne 0 -or ($finalHead.Output -join "`n").Trim() -ine $commit) { throw 'Git HEAD changed while packaging. Run again with a stable checkout; nothing was uploaded.' }
        $finalStatus = Invoke-BackendNative $git @('-C', $root, 'status', '--porcelain', '--untracked-files=normal')
        if ($finalStatus.ExitCode -ne 0) { throw 'Cannot record the final source checkout state; nothing was uploaded.' }
        $sourceDirty = $sourceDirty -or -not [string]::IsNullOrWhiteSpace(($finalStatus.Output -join "`n"))
        $builtAt = [DateTime]::UtcNow
        $tag = 'backend-' + $builtAt.ToString('yyyyMMdd-HHmmss') + '-' + $commit.Substring(0, 8) + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
        $outputRoot = $settings.OutputDirectory
        if (-not $outputRoot) { $outputRoot = Join-Path $root 'richy\richy-app\target\backend-releases' }
        $releaseDirectory = Join-Path ([IO.Path]::GetFullPath($outputRoot)) $tag
        New-Item -ItemType Directory -Path $releaseDirectory | Out-Null
        $assetPath = Join-Path $releaseDirectory 'richy-wine-exec.jar'
        Copy-Item -LiteralPath $selectedJar -Destination $assetPath
        Test-BackendExecutableJar $assetPath
        $sha256 = (Get-FileHash -LiteralPath $assetPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ((Get-FileHash -LiteralPath $selectedJar -Algorithm SHA256).Hash.ToLowerInvariant() -cne $sha256) { throw 'The source JAR changed during the package copy; nothing was uploaded.' }
        $assetBytes = [int64](Get-Item -LiteralPath $assetPath).Length
        $manifest = [ordered]@{
            schemaVersion = 1; tag = $tag; commit = $commit; sourceDirty = [bool]$sourceDirty
            builtAtUtc = $builtAt.ToString('yyyy-MM-ddTHH:mm:ss.fffZ'); javaMajor = 8
            jar = [ordered]@{ name = 'richy-wine-exec.jar'; sha256 = $sha256; bytes = $assetBytes }
        }
        $manifestPath = Join-Path $releaseDirectory 'backend-release.json'
        Write-BackendUtf8 $manifestPath ($manifest | ConvertTo-Json -Depth 4)
        $notesPath = Join-Path $releaseDirectory 'release-notes.md'
        $buildDescription = 'Built core-api first, then richy-api and richy-app with Java 8. Legacy Maven tests were skipped; this is not a functional test.'
        if ($settings.SkipBuild) { $buildDescription = 'Packaged an explicitly supplied existing JAR using -SkipBuild; no Maven build or functional test was performed. The commit identifies the packaging checkout and does not prove the supplied JAR was built from it.' }
        $notes = @('Backend release ' + $tag, '', 'Source commit: ' + $commit, 'Source checkout has uncommitted changes: ' + $sourceDirty, 'Packaged at UTC: ' + $manifest.builtAtUtc, '', $buildDescription, '', 'JAR SHA-256: ' + $sha256, 'JAR bytes: ' + $assetBytes)
        Write-BackendUtf8 $notesPath ($notes -join [Environment]::NewLine)
        if ($buildLines.Count) { Write-BackendUtf8 (Join-Path $releaseDirectory 'build.log') ($buildLines -join [Environment]::NewLine) }
        Write-Host ('Verified local release package: ' + $releaseDirectory)
        if (-not $settings.Publish) { Write-Host 'Local package complete. Use -Publish to upload a private GitHub release.'; return [pscustomobject]@{ Tag = $tag; Directory = $releaseDirectory; Published = $false } }
        # Recheck after a potentially long build, immediately before any upload.
        Assert-BackendPrivateRepository $gh $releaseRepo
        $draftCreated = $false
        try {
            $createArguments = @('release', 'create', $tag, '--repo', $releaseRepo, '--title', ('Backend ' + $tag), '--notes-file', $notesPath, '--draft')
            if ($sourceRepository -and $sourceRepository -ieq $releaseRepo) { $createArguments += @('--target', $commit) }
            $created = Invoke-BackendNative $gh $createArguments
            if ($created.ExitCode -ne 0) { throw 'GitHub draft creation failed.' }
            $draftCreated = $true
            $uploaded = Invoke-BackendNative $gh @('release', 'upload', $tag, '--repo', $releaseRepo, $assetPath, $manifestPath)
            if ($uploaded.ExitCode -ne 0) { throw 'GitHub asset upload failed.' }
            $assets = Invoke-BackendNative $gh @('api', '--hostname', 'github.com', ('repos/' + $releaseRepo + '/releases/tags/' + $tag), '--jq', '.assets[].name')
            if ($assets.ExitCode -ne 0 -or @($assets.Output | Where-Object { $_ -ceq 'richy-wine-exec.jar' }).Count -ne 1 -or
                @($assets.Output | Where-Object { $_ -ceq 'backend-release.json' }).Count -ne 1) { throw 'Both uploaded assets could not be confirmed.' }
            $published = Invoke-BackendNative $gh @('release', 'edit', $tag, '--repo', $releaseRepo, '--draft=false', '--latest=true')
            if ($published.ExitCode -ne 0) { throw 'GitHub release publication could not be confirmed.' }
        } catch {
            $state = 'A draft may exist'
            if ($draftCreated) { $state = 'The uploaded release remains a draft unless the final publish request already succeeded' }
            throw ('Release upload/publication did not complete. ' + $state + ' at https://github.com/' + $releaseRepo + '/releases/tag/' + $tag + '. Inspect that release in GitHub, verify both assets against the local manifest, and either recover it or delete the draft before retrying. No server action was performed. Local package: ' + $releaseDirectory + '. Captured GitHub output was suppressed.')
        }
        Write-Host ('Published private backend release: https://github.com/' + $releaseRepo + '/releases/tag/' + $tag)
        return [pscustomobject]@{ Tag = $tag; Directory = $releaseDirectory; Published = $true }
    } finally { $env:JAVA_HOME = $previousJavaHome; $env:PATH = $previousPath }
}

if ($MyInvocation.InvocationName -ne '.') {
    try { Invoke-BackendPublisher -Options $PSBoundParameters | Out-Null }
    catch { Write-Error -Message $_.Exception.Message -ErrorAction Continue; exit 1 }
}
