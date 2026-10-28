$ErrorActionPreference = 'Stop'
$probeRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $probeRoot '..\..\..')).Path
$classes = Join-Path $env:TEMP ('pk-auth-endpoint-review-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $classes | Out-Null
$mavenRoot = Join-Path $env:USERPROFILE '.m2\repository'
$probeClasspath = @(
    $classes
    (Join-Path $repoRoot 'core\core-api\target\classes')
    (Join-Path $repoRoot 'richy\richy-app\target\richy-wine-jar-with-dependencies.jar')
    (Join-Path $mavenRoot 'org\springframework\spring-test\4.3.9.RELEASE\spring-test-4.3.9.RELEASE.jar')
    (Join-Path $mavenRoot 'org\apache\tomcat\embed\tomcat-embed-core\8.5.15\tomcat-embed-core-8.5.15.jar')
) -join ';'
$sourcePaths = @(
    'core/core-api/src/main/java/com/globits/security/rest/RestUserController.java'
    'core/core-api/src/main/java/com/globits/security/service/impl/UserServiceImpl.java'
    'core/core-api/src/main/java/com/globits/security/dto/UserDto.java'
    'core/core-api/src/main/java/com/globits/security/rest/TokenController.java'
    'richy/richy-app/src/main/java/com/globits/richy/config/OAuth2ResourceServerConfig.java'
    'richy/richy-app/src/main/java/com/globits/richy/config/WebSecurityConfig.java'
    'richy/richy-app/src/main/java/com/globits/richy/config/MethodSecurityConfig.java'
) | ForEach-Object { Join-Path $repoRoot $_ }
$sourcePaths += Join-Path $probeRoot 'AuthEndpointSecurityProbe.java'
& javac -g -encoding UTF-8 -cp $probeClasspath -d $classes @sourcePaths
if ($LASTEXITCODE -ne 0) { throw 'Probe compilation failed.' }
& java -cp $probeClasspath AuthEndpointSecurityProbe 2>&1 | Tee-Object -FilePath (Join-Path $probeRoot 'probe-result.log')
if ($LASTEXITCODE -ne 0) { throw 'Probe failed.' }
