param(
    [string]$MavenRepository = (Join-Path $env:USERPROFILE '.m2\repository'),
    [string]$JavaDirectory = 'C:\Program Files\Java\jdk1.8.0_131'
)
$ErrorActionPreference = 'Stop'
$probeLibraries = @(
    'org\springframework\security\oauth\spring-security-oauth2\2.0.14.RELEASE\spring-security-oauth2-2.0.14.RELEASE.jar',
    'org\springframework\security\spring-security-core\4.2.3.RELEASE\spring-security-core-4.2.3.RELEASE.jar',
    'org\springframework\spring-core\4.3.9.RELEASE\spring-core-4.3.9.RELEASE.jar',
    'org\springframework\spring-beans\4.3.9.RELEASE\spring-beans-4.3.9.RELEASE.jar',
    'org\springframework\spring-context\4.3.9.RELEASE\spring-context-4.3.9.RELEASE.jar',
    'org\springframework\spring-tx\4.3.9.RELEASE\spring-tx-4.3.9.RELEASE.jar',
    'commons-logging\commons-logging\1.2\commons-logging-1.2.jar'
) | ForEach-Object {
    $libraryPath = Join-Path $MavenRepository $_
    if (!(Test-Path -LiteralPath $libraryPath)) { throw "Missing dependency: $libraryPath" }
    $libraryPath
}
$probeClassPath = $probeLibraries -join ';'
$probeClassDirectory = Join-Path $env:TEMP ('pk-auth-review-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $probeClassDirectory | Out-Null
& (Join-Path $JavaDirectory 'bin\javac.exe') -cp $probeClassPath -d $probeClassDirectory (Join-Path $PSScriptRoot 'AuthProbe.java')
if ($LASTEXITCODE -ne 0) { throw "javac failed with exit code $LASTEXITCODE" }
& (Join-Path $JavaDirectory 'bin\java.exe') -cp ($probeClassDirectory + ';' + $probeClassPath) AuthProbe
if ($LASTEXITCODE -ne 0) { throw "Probe failed with exit code $LASTEXITCODE" }
