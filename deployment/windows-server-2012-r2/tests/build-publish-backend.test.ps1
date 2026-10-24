# Test the production publisher with real ZIP/hash/filesystem validation and
# mocked Git, Java, Maven and GitHub boundaries. No network or legacy build.
$ErrorActionPreference = 'Stop'
$productionPath = Join-Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)) 'Build-PublishBackend.ps1'
. $productionPath
$fixtureParent = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $productionPath))) 'richy\richy-app\target'))
$fixtureDirectory = [IO.Path]::GetFullPath((Join-Path $fixtureParent ('publisher-test-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))))
New-Item -ItemType Directory -Path $fixtureDirectory | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$originalNative = ${function:Invoke-BackendNative}
$originalResolver = ${function:Resolve-BackendCommand}
$script:fixtureCommit = '0123456789abcdef0123456789abcdef01234567'
$script:secretMarker = 'fixture-secret-must-never-be-published'

function Assert-Publisher($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }

function Add-PublisherClass($Archive, [string]$Name, [int]$Major = 52) {
    $entry = $Archive.CreateEntry($Name)
    $stream = $entry.Open()
    try {
        $bytes = [byte[]]@(202, 254, 186, 190, 0, 0, 0, $Major)
        $stream.Write($bytes, 0, $bytes.Length)
    } finally { $stream.Dispose() }
}

function Add-PublisherLibrary($Archive, [string]$Name) {
    $buffer = New-Object IO.MemoryStream
    $nested = New-Object IO.Compression.ZipArchive($buffer, [IO.Compression.ZipArchiveMode]::Create, $true)
    try { Add-PublisherClass $nested 'com/globits/Fixture.class' }
    finally { $nested.Dispose() }
    $stream = $Archive.CreateEntry('BOOT-INF/lib/' + $Name).Open()
    try { $buffer.Position = 0; $buffer.CopyTo($stream) }
    finally { $stream.Dispose(); $buffer.Dispose() }
}

function New-PublisherJar([string]$Path, [int]$Major = 52, [switch]$Incomplete) {
    $archive = [IO.Compression.ZipFile]::Open($Path, [IO.Compression.ZipArchiveMode]::Create)
    try {
        Add-PublisherClass $archive 'org/springframework/boot/loader/JarLauncher.class'
        Add-PublisherClass $archive 'BOOT-INF/classes/com/globits/richy/RichyApplication.class' $Major
        $writer = New-Object IO.StreamWriter($archive.CreateEntry('META-INF/MANIFEST.MF').Open())
        try { $writer.Write("Manifest-Version: 1.0`r`nMain-Class: org.springframework.boot.loader.JarLauncher`r`nStart-Class: com.globits.richy.RichyApplication`r`n`r`n") }
        finally { $writer.Dispose() }
        if (-not $Incomplete) {
            Add-PublisherLibrary $archive 'core-api-1.0.0-SNAPSHOT.jar'
            Add-PublisherLibrary $archive 'richy-api-1.0.0-SNAPSHOT.jar'
        }
    } finally { $archive.Dispose() }
}

function Resolve-BackendCommand([string]$Name) {
    if ($Name -eq 'git.exe') { return (Join-Path $script:caseDirectory 'git.exe') }
    if ($Name -eq 'gh.exe' -and $script:scenario -ne 'missing-gh') { return (Join-Path $script:caseDirectory 'gh.exe') }
    return $null
}

function Invoke-BackendNative([string]$Executable, [string[]]$Arguments) {
    $script:actions.Add([pscustomobject]@{Executable = $Executable; Arguments = @($Arguments)}) | Out-Null
    $exitCode = 0
    $output = @()
    $leaf = Split-Path -Leaf $Executable
    if ($leaf -eq 'git.exe') {
        if ($Arguments -contains 'rev-parse') { $output = @($script:fixtureCommit) }
        elseif ($Arguments -contains 'status') {
            if ($script:scenario -eq 'dirty-source') { $output = @(' M fixture-source.java') }
        } elseif ($Arguments -contains 'get-url') { $output = @('https://' + $script:secretMarker + '@github.com/source/backend.git') }
        else { throw 'Unexpected Git invocation in fixture.' }
    } elseif ($leaf -in @('java.exe', 'javac.exe')) {
        if ($script:scenario -eq 'newer-jdk') { $output = @('java version "17.0.1"') }
        elseif ($leaf -eq 'java.exe') { $output = @('java version "1.8.0_131"') }
        else { $output = @('javac 1.8.0_131') }
    } elseif ($leaf -eq 'mvn.cmd') {
        if ($Arguments -contains '-version') { $output = @('Apache Maven 3.9.12') }
        else {
            Assert-Publisher ($Arguments -contains '-Dmaven.test.skip=true') 'Build did not explicitly skip the legacy tests.'
            Assert-Publisher ($Arguments -contains 'clean') 'Build must clean each reactor.'
            if ($Arguments -contains 'install') {
                Assert-Publisher ($Arguments -contains 'core-api' -and $Arguments -contains '-am') 'core-api must be built with its parent.'
                if ($script:scenario -eq 'core-build-failure') { $exitCode = 12 }
            } elseif ($Arguments -contains 'package') {
                if ($script:scenario -eq 'richy-build-failure') { $exitCode = 13 }
                else {
                    $target = Join-Path $script:caseDirectory 'richy\richy-app\target'
                    New-Item -ItemType Directory -Path $target -Force | Out-Null
                    Copy-Item -LiteralPath $script:inputJar -Destination (Join-Path $target 'richy-wine-exec.jar') -Force
                }
            } else { throw 'Unexpected Maven invocation.' }
            $output = @('Fixture build output.')
        }
    } elseif ($leaf -eq 'gh.exe') {
        # Secrets in native stderr/stdout must never leak into console messages,
        # release notes, or manifest assets, including when gh fails.
        $output = @($script:secretMarker)
        if ($Arguments[0] -eq 'auth') {
            if ($script:scenario -eq 'unauthenticated') { $exitCode = 1 }
        } elseif ($Arguments[0] -eq 'api' -and $Arguments -contains '.private') {
            $script:privacyChecks++
            $private = $script:scenario -ne 'public-repository' -and -not ($script:scenario -eq 'private-recheck-failure' -and $script:privacyChecks -gt 1)
            $output = @(([string]$private).ToLowerInvariant())
        } elseif ($Arguments[0] -eq 'api' -and $Arguments -contains '.assets[].name') {
            $output = @('richy-wine-exec.jar', 'backend-release.json')
            if ($script:scenario -eq 'missing-remote-asset') { $output = @('richy-wine-exec.jar') }
        } elseif ($Arguments[0] -eq 'release' -and $Arguments[1] -eq 'create') {
            Assert-Publisher ($Arguments -contains '--draft' -and $Arguments -contains '--notes-file') 'Release must start as a draft with notes read from a file.'
        } elseif ($Arguments[0] -eq 'release' -and $Arguments[1] -eq 'upload') {
            $jar = @($Arguments | Where-Object { $_ -match '[\\/]richy-wine-exec\.jar$' })
            $manifest = @($Arguments | Where-Object { $_ -match '[\\/]backend-release\.json$' })
            Assert-Publisher ($jar.Count -eq 1 -and $manifest.Count -eq 1) 'Both fixed assets must be uploaded together.'
            if ($script:scenario -eq 'upload-failure') { $exitCode = 1 }
        } elseif ($Arguments[0] -eq 'release' -and $Arguments[1] -eq 'edit') {
            Assert-Publisher ($Arguments -contains '--draft=false' -and $Arguments -contains '--latest=true') 'Only a complete release may become latest.'
            if ($script:scenario -eq 'publish-failure') { $exitCode = 1 }
        } else { throw 'Unexpected GitHub invocation.' }
    } else { throw ('Unexpected executable: ' + $leaf) }
    return [pscustomobject]@{ExitCode = $exitCode; Output = $output}
}

try {
    $cases = @('local-package', 'dirty-source', 'publish-success', 'artifact-repository', 'build-success', 'core-build-failure', 'richy-build-failure',
        'upload-failure', 'missing-remote-asset', 'publish-failure', 'missing-gh', 'unauthenticated', 'public-repository', 'private-recheck-failure',
        'check-only', 'newer-jdk', 'incomplete-jar', 'newer-bytecode')
    foreach ($caseName in $cases) {
        $script:scenario = $caseName
        $script:caseDirectory = Join-Path $fixtureDirectory $caseName
        $script:actions = New-Object 'System.Collections.Generic.List[object]'
        $script:privacyChecks = 0
        foreach ($folder in @('core\core-api', 'richy\richy-app', 'java home\bin', 'maven home\bin')) {
            New-Item -ItemType Directory -Path (Join-Path $script:caseDirectory $folder) -Force | Out-Null
        }
        foreach ($file in @('core\pom.xml', 'core\core-api\pom.xml', 'richy\pom.xml', 'richy\richy-app\pom.xml', 'java home\bin\java.exe', 'java home\bin\javac.exe', 'maven home\bin\mvn.cmd')) {
            Set-Content -LiteralPath (Join-Path $script:caseDirectory $file) -Value 'fixture' -Encoding ASCII
        }
        $script:inputJar = Join-Path $script:caseDirectory 'already built.jar'
        if ($caseName -eq 'incomplete-jar') { New-PublisherJar $script:inputJar -Incomplete }
        elseif ($caseName -eq 'newer-bytecode') { New-PublisherJar $script:inputJar -Major 61 }
        else { New-PublisherJar $script:inputJar }
        $options = @{
            RepositoryRoot = $script:caseDirectory
            JavaHome = (Join-Path $script:caseDirectory 'java home')
            MavenHome = (Join-Path $script:caseDirectory 'maven home')
            SkipBuild = $true; JarPath = $script:inputJar
            Publish = ($caseName -notin @('local-package', 'dirty-source', 'newer-jdk'))
        }
        if ($caseName -in @('build-success', 'core-build-failure', 'richy-build-failure', 'check-only')) {
            $options.SkipBuild = $false
            $options.JarPath = ''
            $options.Offline = $true
            $staleTarget = Join-Path $script:caseDirectory 'richy\richy-app\target'
            New-Item -ItemType Directory -Path $staleTarget | Out-Null
            Copy-Item -LiteralPath $script:inputJar -Destination (Join-Path $staleTarget 'richy-wine-exec.jar')
        }
        if ($caseName -eq 'artifact-repository') { $options.ReleaseRepository = 'private/artifacts' }
        if ($caseName -eq 'check-only') { $options.CheckOnly = $true }
        $savedJavaHome = $env:JAVA_HOME
        $savedPath = $env:PATH
        $failure = $null
        $captured = @(& {
            try { Invoke-BackendPublisher $options }
            catch { $script:caseFailure = $_.Exception.Message }
        } 6>&1)
        $failure = $script:caseFailure
        $script:caseFailure = $null
        Assert-Publisher ($env:JAVA_HOME -ceq $savedJavaHome -and $env:PATH -ceq $savedPath) ('Environment was not restored: ' + $caseName)
        $allMessages = ($captured | ForEach-Object { [string]$_ }) -join "`n"
        Assert-Publisher (-not ($allMessages + $failure).Contains($script:secretMarker)) ('Native secret leaked in messages: ' + $caseName)
        $ghActions = @($script:actions | Where-Object { (Split-Path -Leaf $_.Executable) -eq 'gh.exe' })
        $releaseActions = @($ghActions | Where-Object { $_.Arguments[0] -eq 'release' })
        $mavenBuilds = @($script:actions | Where-Object { (Split-Path -Leaf $_.Executable) -eq 'mvn.cmd' -and $_.Arguments -notcontains '-version' })
        $creates = @($releaseActions | Where-Object { $_.Arguments[1] -eq 'create' })
        $edits = @($releaseActions | Where-Object { $_.Arguments[1] -eq 'edit' })
        $success = $caseName -in @('local-package', 'dirty-source', 'publish-success', 'artifact-repository', 'build-success', 'check-only')
        if ($success) { Assert-Publisher (-not $failure) ('Unexpected failure in ' + $caseName + ': ' + $failure) }
        else { Assert-Publisher ([bool]$failure) ('Expected rejection in ' + $caseName) }
        if ($caseName -in @('core-build-failure', 'richy-build-failure', 'missing-gh', 'unauthenticated', 'public-repository', 'private-recheck-failure', 'check-only', 'newer-jdk', 'incomplete-jar', 'newer-bytecode')) {
            Assert-Publisher ($releaseActions.Count -eq 0) ('Release mutation occurred before validation: ' + $caseName)
        }
        if ($caseName -in @('missing-gh', 'unauthenticated', 'public-repository')) {
            Assert-Publisher (@($script:actions | Where-Object { (Split-Path -Leaf $_.Executable) -in @('java.exe', 'javac.exe', 'mvn.cmd') }).Count -eq 0) 'Publishing preflight must fail before Java/Maven/build work.'
        }
        if ($caseName -in @('upload-failure', 'missing-remote-asset')) {
            Assert-Publisher ($creates.Count -eq 1 -and $edits.Count -eq 0 -and $failure -match 'draft') 'An incomplete upload must remain a draft with recovery guidance.'
        }
        if ($caseName -eq 'core-build-failure') { Assert-Publisher ($mavenBuilds.Count -eq 1) 'A failed core build must prevent the richy build and stale-JAR upload.' }
        if ($caseName -eq 'richy-build-failure') { Assert-Publisher ($mavenBuilds.Count -eq 2) 'The richy stage must follow core-api.' }
        if ($caseName -eq 'build-success') {
            Assert-Publisher ($mavenBuilds.Count -eq 2 -and $mavenBuilds[0].Arguments -contains 'install' -and $mavenBuilds[1].Arguments -contains 'package') 'Build reactors ran in the wrong order.'
            foreach ($build in $mavenBuilds) { Assert-Publisher ($build.Arguments -contains '-o') 'Offline option was not preserved.' }
        }
        if ($caseName -in @('publish-success', 'artifact-repository', 'build-success')) {
            Assert-Publisher (($releaseActions | ForEach-Object { $_.Arguments[1] }) -join ',' -ceq 'create,upload,edit') 'Publication must create draft, upload both, then publish.'
            if ($caseName -eq 'artifact-repository') { Assert-Publisher ($creates[0].Arguments -notcontains '--target') 'A separate artifact repository must use its own default branch, not the source commit.' }
            else { Assert-Publisher ($creates[0].Arguments -contains '--target' -and $creates[0].Arguments -contains $script:fixtureCommit) 'A same-repository release must target the source commit.' }
        }
        if ($caseName -in @('local-package', 'dirty-source')) { Assert-Publisher ($ghActions.Count -eq 0) 'Local packaging must not require or contact GitHub.' }
        if ($caseName -eq 'check-only') {
            Assert-Publisher ($mavenBuilds.Count -eq 0) 'CheckOnly ran a Maven build.'
            Assert-Publisher (-not (Test-Path -LiteralPath (Join-Path $script:caseDirectory 'richy\richy-app\target\backend-releases'))) 'CheckOnly created a release package.'
        } elseif ($success) {
            $result = @($captured | Where-Object { $_ -is [pscustomobject] -and $_.PSObject.Properties['Directory'] }) | Select-Object -Last 1
            Assert-Publisher ([bool]$result) ('Missing package result: ' + $caseName)
            $manifestPath = Join-Path $result.Directory 'backend-release.json'
            $manifestText = Get-Content -LiteralPath $manifestPath -Raw
            $manifest = $manifestText | ConvertFrom-Json
            Assert-Publisher ($manifest.schemaVersion -eq 1 -and $manifest.javaMajor -eq 8 -and $manifest.commit -ceq $script:fixtureCommit) 'Manifest identity is incorrect.'
            Assert-Publisher ($manifest.tag -match '^backend-[0-9]{8}-[0-9]{6}-01234567-[0-9a-f]{8}$') 'Tag does not match the server poller contract.'
            Assert-Publisher ($manifest.jar.name -ceq 'richy-wine-exec.jar' -and $manifest.jar.sha256 -cmatch '^[0-9a-f]{64}$') 'Manifest asset/hash is incorrect.'
            $jar = Get-Item -LiteralPath (Join-Path $result.Directory 'richy-wine-exec.jar')
            Assert-Publisher ($manifest.jar.bytes -eq $jar.Length -and $manifest.jar.sha256 -ceq (Get-FileHash -LiteralPath $jar.FullName -Algorithm SHA256).Hash.ToLowerInvariant()) 'Manifest checksum or byte count does not match the actual asset.'
            Assert-Publisher ($manifest.sourceDirty -eq ($caseName -eq 'dirty-source')) 'Dirty source state was not recorded honestly.'
            $notes = Get-Content -LiteralPath (Join-Path $result.Directory 'release-notes.md') -Raw
            Assert-Publisher (-not ($manifestText + $notes).Contains($script:secretMarker)) 'A secret leaked into published metadata.'
            if ($options.SkipBuild) { Assert-Publisher ($notes -match 'does not prove') 'SkipBuild must disclose that the source commit is not proven for the supplied binary.' }
        }
        Write-Output ('PASS: ' + $caseName)
    }
    # Exercise the actual native .cmd invocation boundary, including spaces and
    # exit-code preservation, without invoking any real build or external app.
    $nativeFixture = Join-Path $fixtureDirectory 'native tool with spaces.cmd'
    Set-Content -LiteralPath $nativeFixture -Value "@echo off`r`necho %~1`r`nexit /b 7`r`n" -Encoding ASCII
    $nativeResult = & $originalNative $nativeFixture @('one argument with spaces')
    Assert-Publisher ($nativeResult.ExitCode -eq 7 -and ($nativeResult.Output -join "`n") -ceq 'one argument with spaces') 'Native .cmd invocation lost arguments or exit status.'
    Write-Output 'PASS: native-cmd-boundary'
} finally {
    ${function:Invoke-BackendNative} = $originalNative
    ${function:Resolve-BackendCommand} = $originalResolver
    $testPrefix = $fixtureParent.TrimEnd('\') + '\'
    if (-not $fixtureDirectory.StartsWith($testPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path -Leaf $fixtureDirectory) -notmatch '^publisher-test-[0-9a-f]{8}$') { throw 'Refusing to clean an unexpected fixture directory.' }
    Remove-Item -LiteralPath $fixtureDirectory -Recurse -Force
}
