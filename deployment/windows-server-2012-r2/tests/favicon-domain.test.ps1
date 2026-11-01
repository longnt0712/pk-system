$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$app = Join-Path $repository 'richy\app'
[xml]$config = [IO.File]::ReadAllText((Join-Path $app 'web.config'))
$html = [IO.File]::ReadAllText((Join-Path $app 'index.html'))
$rewrite = $config.configuration.'system.webServer'.rewrite
$icons = [regex]::Matches($html,'<link\b[^>]*rel="(?:shortcut )?icon"[^>]*>')
if ($icons.Count -ne 1 -or $icons[0].Value.Contains('ng-if')) { throw 'Raw HTML must have exactly one unconditional favicon.' }
$rule = @($rewrite.outboundRules.rule | Where-Object { [string]$_.name -eq 'TNTT favicon' })[0]
$precondition = @($rewrite.outboundRules.preConditions.preCondition | Where-Object { [string]$_.name -eq [string]$rule.preCondition })[0]
$hostCondition = @($precondition.add | Where-Object { [string]$_.input -eq '{HTTP_HOST}' })[0]
if (-not $rule -or -not $hostCondition) { throw 'The favicon rewrite must use the exact TNTT domain precondition.' }
$pattern = [string]$rule.match.pattern
$replacement = ([string]$rule.action.value).Replace('{R:1}','${1}').Replace('{R:2}','${2}')
$domains = @('tnttphungkhoang.com','www.tnttphungkhoang.com','TNTTPHUNGKHOANG.COM:443','ieltsroom.com','www.ieltsroom.com','localhost','tnttphungkhoang.com.evil.test')
foreach ($domain in $domains) {
    $tntt = $domain -in @('tnttphungkhoang.com','www.tnttphungkhoang.com','TNTTPHUNGKHOANG.COM:443')
    $matches = [regex]::IsMatch($domain,[string]$hostCondition.pattern,'IgnoreCase')
    if ($matches -ne $tntt) { throw ('Domain condition matched the wrong host: ' + $domain) }
    $result = if ($matches) { [regex]::Replace($html,$pattern,$replacement) } else { $html }
    $rendered = [regex]::Matches($result,'<link\b[^>]*rel="(?:shortcut )?icon"[^>]*>')
    $expected = if ($tntt) { '/assets/images/troop-1.jpg' } else { '/assets/images/troop.jpg' }
    if ($rendered.Count -ne 1 -or -not $rendered[0].Value.Contains('href="' + $expected + '"')) { throw ('Wrong raw favicon: ' + $domain) }
    # Browsers asking for the conventional path must receive an image, not SPA HTML.
    $selected = $null
    foreach ($inbound in $rewrite.rules.rule) {
        if (-not [regex]::IsMatch('favicon.ico',[string]$inbound.match.url,'IgnoreCase')) { continue }
        $allowed = $true
        foreach ($condition in @($inbound.conditions.add)) {
            if ($null -eq $condition) { continue }
            if ([string]$condition.input -ne '{HTTP_HOST}') { throw 'Unexpected favicon routing condition.' }
            $allowed = $allowed -and [regex]::IsMatch($domain,[string]$condition.pattern,'IgnoreCase')
        }
        if ($allowed) { $selected = $inbound; break }
    }
    if ([string]$selected.action.type -ne 'Redirect' -or [string]$selected.action.redirectType -ne 'Found' -or [string]$selected.action.url -ne $expected) { throw ('Wrong favicon fallback: ' + $domain) }
    if (-not (Test-Path -LiteralPath (Join-Path $app $expected.TrimStart('/')) -PathType Leaf)) { throw ('Missing icon: ' + $expected) }
}
Write-Output ('PASS: one raw favicon, exact domain selection and image fallback on ' + $domains.Count + ' hosts.')
