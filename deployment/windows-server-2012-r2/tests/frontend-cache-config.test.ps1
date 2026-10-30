# Windows PowerShell 5.1: validate the real IIS XML and its routing/header conditions.
# This does not start IIS, send network requests, or deploy files.
$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
[xml]$config = [IO.File]::ReadAllText((Join-Path $repository 'richy\app\web.config'))
$rewrite = $config.configuration.'system.webServer'.rewrite
$headers = @{
    RESPONSE_Cache_Control = 'Cache-Control'
    RESPONSE_Pragma = 'Pragma'
    RESPONSE_Expires = 'Expires'
}

function Assert-Test([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

function Test-Conditions($Conditions, [hashtable]$Variables) {
    foreach ($condition in @($Conditions.add)) {
        $inputName = [string]$condition.input
        if (-not $Variables.ContainsKey($inputName)) { throw ('Unsupported condition input: ' + $inputName) }
        $matches = [regex]::IsMatch([string]$Variables[$inputName], [string]$condition.pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ([string]$condition.negate -eq 'true') { $matches = -not $matches }
        if (-not $matches) { return $false }
    }
    return $true
}

function Apply-EntryHeaders([string]$FileName, [string]$Uri, [string]$ContentType) {
    # Seed deliberately cacheable values to ensure rules replace inherited headers.
    $result = @{'Cache-Control'='public, max-age=86400'; 'Pragma'='old'; 'Expires'='Wed, 01 Jan 2031 00:00:00 GMT'}
    $variables = @{'{REQUEST_FILENAME}'=$FileName; '{REQUEST_URI}'=$Uri; '{RESPONSE_CONTENT_TYPE}'=$ContentType}
    foreach ($rule in @($rewrite.outboundRules.rule)) {
        $serverVariable = [string]$rule.match.serverVariable
        if (-not $headers.ContainsKey($serverVariable)) { continue }
        $name = [string]$rule.preCondition
        $precondition = @($rewrite.outboundRules.preConditions.preCondition | Where-Object { [string]$_.name -eq $name })
        Assert-Test ($precondition.Count -eq 1) ('Missing/ambiguous header precondition: ' + $name)
        Assert-Test ([string]$precondition[0].logicalGrouping -eq 'MatchAll') 'Entry header checks must all match.'
        if (Test-Conditions $precondition[0] $variables) {
            Assert-Test ([string]$rule.action.type -eq 'Rewrite') 'Headers must be rewritten, not redirect requests.'
            $headerName = $headers[$serverVariable]
            if ([regex]::IsMatch($result[$headerName], [string]$rule.match.pattern)) {
                $result[$headerName] = [string]$rule.action.value
            }
        }
    }
    return $result
}

$fallback = @($rewrite.rules.rule | Where-Object { [string]$_.action.url -eq '/index.html' })
Assert-Test ($fallback.Count -eq 1) 'The SPA fallback must still exist.'
$exclusion = @($fallback[0].conditions.add | Where-Object { [string]$_.input -eq '{REQUEST_URI}' })
Assert-Test ($exclusion.Count -eq 1 -and [string]$exclusion[0].negate -eq 'true') 'The fallback must exclude backend routes.'

$cases = @(
    @{Uri='/index.html'; File='C:\site\index.html'; Type='text/html'; Fresh=$true},
    @{Uri='/INDEX.HTML?v=old'; File='C:\site\INDEX.HTML'; Type='text/html; charset=utf-8'; Fresh=$true},
    @{Uri='/'; File='C:\site\index.html'; Type='text/html'; Fresh=$true},
    @{Uri='/dashboard'; File='C:\site\index.html'; Type='text/html'; Fresh=$true; Rewritten=$true},
    @{Uri='/speaking?set=12'; File='C:\site\index.html'; Type='text/html; charset=utf-8'; Fresh=$true; Rewritten=$true},
    @{Uri='/ielts_listening_actual_test/42'; File='C:\site\index.html'; Type='text/html'; Fresh=$true; Rewritten=$true},
    @{Uri='/assets/css/custom.css?v=release'; File='C:\site\assets\css\custom.css'; Type='text/css'; Fresh=$false},
    @{Uri='/question/controllers/SpeakingController.js?v=release'; File='C:\site\question\controllers\SpeakingController.js'; Type='application/javascript'; Fresh=$false},
    @{Uri='/question/views/speaking.html?v=release'; File='C:\site\question\views\speaking.html'; Type='text/html'; Fresh=$false},
    @{Uri='/assets/vendor/index.html'; File='C:\site\assets\vendor\index.html'; Type='text/html'; Fresh=$false},
    @{Uri='/service/public/site-theme/ieltsroom'; File='C:\site\service\public\site-theme\ieltsroom'; Type='application/json'; Fresh=$false},
    @{Uri='/service/index.html'; File='C:\site\service\index.html'; Type='text/html'; Fresh=$false},
    @{Uri='/api/index.html'; File='C:\site\api\index.html'; Type='text/html'; Fresh=$false},
    @{Uri='/public/index.html'; File='C:\site\public\index.html'; Type='text/html'; Fresh=$false},
    @{Uri='/oauth/index.html'; File='C:\site\oauth\index.html'; Type='text/html'; Fresh=$false}
)

foreach ($case in $cases) {
    if ($case.Rewritten) {
        Assert-Test (-not [regex]::IsMatch($case.Uri, [string]$exclusion[0].pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)) ('SPA route was excluded from fallback: ' + $case.Uri)
    }
    $actual = Apply-EntryHeaders $case.File $case.Uri $case.Type
    if ($case.Fresh) {
        Assert-Test ($actual['Cache-Control'] -eq 'no-cache, no-store, must-revalidate') ('Entry Cache-Control is stale: ' + $case.Uri)
        Assert-Test ($actual.Pragma -eq 'no-cache' -and $actual.Expires -eq '0') ('Legacy entry cache headers are stale: ' + $case.Uri)
    } else {
        Assert-Test ($actual['Cache-Control'] -eq 'public, max-age=86400' -and $actual.Pragma -eq 'old' -and $actual.Expires -eq 'Wed, 01 Jan 2031 00:00:00 GMT') ('Entry rule changed an asset or backend response: ' + $case.Uri)
    }
}

$service = @($rewrite.rules.rule | Where-Object { [string]$_.name -eq 'Backend service' })
Assert-Test ($service.Count -eq 1 -and [string]$service[0].action.url -eq 'http://127.0.0.1:8085/service/{R:1}') 'Backend proxy routing changed.'
Assert-Test (@($rewrite.outboundRules.rule | Where-Object { [string]$_.preCondition -eq 'TnttHtmlResponse' }).Count -eq 4) 'Domain metadata rules changed.'
$entryLocation = @($config.configuration.location | Where-Object { [string]$_.path -eq 'index.html' })
Assert-Test ($entryLocation.Count -eq 1 -and [string]$entryLocation[0].'system.webServer'.urlCompression.doStaticCompression -eq 'false' -and [string]$entryLocation[0].'system.webServer'.urlCompression.doDynamicCompression -eq 'false') 'Index metadata compression settings changed.'
Write-Output ('PASS: real IIS XML, ' + $cases.Count + ' entry/asset/API cases, existing routing and metadata preserved.')
