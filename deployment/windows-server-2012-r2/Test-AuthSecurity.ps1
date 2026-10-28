[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Join-Path $PSScriptRoot '..\..'),
    [string]$JavaDirectory = 'C:\Program Files\Java\jdk1.8.0_131',
    [string]$MavenRepository = (Join-Path $env:USERPROFILE '.m2\repository'),
    [string]$DependencyJar
)

# Offline regression runner. Only compiles into a new temporary directory and uses
# synthetic users, clients and isolated in-memory/H2 stores. It never starts the
# application or connects to an application database.
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
if (-not $DependencyJar) {
    $DependencyJar = Join-Path $taskRoot 'richy\richy-app\target\richy-wine-jar-with-dependencies.jar'
}
$taskLibraries = @(
    $DependencyJar
    (Join-Path $MavenRepository 'org\springframework\spring-test\4.3.9.RELEASE\spring-test-4.3.9.RELEASE.jar')
    (Join-Path $MavenRepository 'org\apache\tomcat\embed\tomcat-embed-core\8.5.15\tomcat-embed-core-8.5.15.jar')
    (Join-Path $MavenRepository 'junit\junit\4.12\junit-4.12.jar')
    (Join-Path $MavenRepository 'org\hamcrest\hamcrest-core\1.3\hamcrest-core-1.3.jar')
    (Join-Path $MavenRepository 'com\h2database\h2\1.4.195\h2-1.4.195.jar')
)
foreach ($taskLibrary in $taskLibraries) {
    if (-not (Test-Path -LiteralPath $taskLibrary -PathType Leaf)) {
        throw "Missing local test dependency: $taskLibrary. Build the backend or pass -DependencyJar; this runner does not download dependencies."
    }
}
$taskJavac = Join-Path $JavaDirectory 'bin\javac.exe'
$taskJava = Join-Path $JavaDirectory 'bin\java.exe'
if (-not (Test-Path -LiteralPath $taskJavac) -or -not (Test-Path -LiteralPath $taskJava)) {
    throw 'Select a Java 8 JDK with -JavaDirectory.'
}
$taskClasses = Join-Path $env:TEMP ('pk-auth-security-tests-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskClasses | Out-Null
$taskClasspath = (@($taskClasses) + $taskLibraries) -join ';'
$taskSources = @(
    Get-ChildItem -LiteralPath (Join-Path $taskRoot 'core\core-api\src\main\java') -Recurse -File -Filter '*.java' | Select-Object -ExpandProperty FullName
    Get-ChildItem -LiteralPath (Join-Path $taskRoot 'richy\richy-app\src\main\java\com\globits\richy\config') -File -Filter '*.java' | Select-Object -ExpandProperty FullName
    Get-ChildItem -LiteralPath (Join-Path $taskRoot 'core\core-app\src\main\java\com\globits\config') -File -Filter '*.java' | Select-Object -ExpandProperty FullName
    Get-ChildItem -LiteralPath (Join-Path $taskRoot 'core\core-api\src\test\java\com\globits\security') -Recurse -File -Filter '*Test.java' | Select-Object -ExpandProperty FullName
    Get-ChildItem -LiteralPath (Join-Path $taskRoot 'richy\richy-app\src\test\java\com\globits\richy\security') -File -Filter '*Test.java' | Select-Object -ExpandProperty FullName
)
$taskArgumentFile = Join-Path $taskClasses 'sources.args'
[IO.File]::WriteAllLines($taskArgumentFile, @($taskSources | ForEach-Object { '"' + $_.Replace('\', '/') + '"' }), [Text.UTF8Encoding]::new($false))
& $taskJavac -g -encoding UTF-8 -cp $taskClasspath -d $taskClasses ('@' + $taskArgumentFile)
if ($LASTEXITCODE -ne 0) { throw 'Security regression compilation failed.' }
$taskTests = @(
    'com.globits.security.service.impl.UserPasswordSecurityTest'
    'com.globits.security.service.impl.RoleSessionInvalidationTest'
    'com.globits.security.UserCredentialSerializationTest'
    'com.globits.security.CustomUserDetailsServiceTest'
    'com.globits.security.UserAuthVersionTest'
    'com.globits.richy.security.AuthSecurityRegressionTest'
    'com.globits.richy.security.JdbcTokenSecurityTest'
)
& $taskJava -cp $taskClasspath org.junit.runner.JUnitCore @taskTests
if ($LASTEXITCODE -ne 0) { throw 'Security regression tests failed.' }
