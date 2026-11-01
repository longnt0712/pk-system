$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$app = Join-Path $root 'richy\app'
[xml]$config = [IO.File]::ReadAllText((Join-Path $app 'web.config'))
$rewrite = $config.configuration.'system.webServer'.rewrite
$source = [IO.File]::ReadAllText((Join-Path $app 'index.html'))
function Assert-Seo([bool]$value,[string]$message) { if (-not $value) { throw $message } }
function Match-Seo($conditions,$variables) {
    foreach ($condition in @($conditions.add)) {
        if ($null -eq $condition) { continue }
        $key = [string]$condition.input
        if (-not $variables.ContainsKey($key)) { throw ('Unknown variable: '+$key) }
        $matches = [regex]::IsMatch([string]$variables[$key],[string]$condition.pattern,'IgnoreCase')
        if ([string]$condition.negate -eq 'true') { $matches = -not $matches }
        if (-not $matches) { return $false }
    }
    return $true
}
function Render-Seo([string]$domain,[string]$url) {
    $variables = @{'{HTTP_HOST}'=$domain;'{REQUEST_URI}'=$url;'{UNENCODED_URL}'=$url;'{REQUEST_FILENAME}'='C:\site\index.html';'{RESPONSE_CONTENT_TYPE}'='text/html'}
    $html = $source; $headers = @{}
    foreach ($rule in $rewrite.outboundRules.rule) {
        $pre = @($rewrite.outboundRules.preConditions.preCondition | Where-Object { [string]$_.name -eq [string]$rule.preCondition })[0]
        if (-not (Match-Seo $pre $variables)) { continue }
        if ($rule.match.serverVariable) { $headers[[string]$rule.match.serverVariable]=[string]$rule.action.value; continue }
        $replacement = ([string]$rule.action.value).Replace('{HtmlEncode:{UNENCODED_URL}}',[Net.WebUtility]::HtmlEncode($url))
        for ($i=0;$i -le 9;$i++) { $replacement=$replacement.Replace('{R:'+$i+'}','${'+$i+'}') }
        $regex = New-Object Text.RegularExpressions.Regex([string]$rule.match.pattern)
        $html = $regex.Replace($html,$replacement,1)
    }
    return @{Html=$html;Headers=$headers}
}
$count = 0
foreach ($domain in @('ieltsroom.com','www.ieltsroom.com','tnttphungkhoang.com','www.tnttphungkhoang.com','tnttphungkhoang.com.evil.test')) {
    $tntt = $domain -in @('tnttphungkhoang.com','www.tnttphungkhoang.com')
    $canonicalHost = if ($tntt) {'tnttphungkhoang.com'} else {'ieltsroom.com'}
    foreach ($path in @('/','/login','/login?notice=1','/index.html','/dashboard','/english_classes?scheduleClassId=34','/ielts_reading_actual_test/42','/hoa-thieng/c/private-code')) {
        $response=Render-Seo $domain $path
        $titles=[regex]::Matches($response.Html,'<title\b[^>]*>([^<]+)</title>')
        Assert-Seo ($titles.Count -eq 1 -and $titles[0].Groups[1].Value.StartsWith($(if($tntt){'TNTT '}else{'IELTS Room'}))) ('Wrong raw title: '+$domain+$path)
        $private=$path -in @('/dashboard','/english_classes?scheduleClassId=34','/ielts_reading_actual_test/42','/hoa-thieng/c/private-code')
        $canonical=[regex]::Matches($response.Html,'<link id="site-canonical"[^>]*href="([^"]+)"')
        if ($private) {
            Assert-Seo ($response.Headers['RESPONSE_X_Robots_Tag'] -eq 'noindex, nofollow') ('Private route is indexable: '+$path)
            Assert-Seo ($canonical.Count -eq 0) 'Private routes must not canonicalize unrelated content to the homepage.'
        } else {
            Assert-Seo (-not $response.Headers.ContainsKey('RESPONSE_X_Robots_Tag')) 'Public home must remain indexable.'
            Assert-Seo ($canonical.Count -eq 1 -and $canonical[0].Groups[1].Value -eq ('https://'+$canonicalHost+'/')) 'Wrong home canonical.'
        }
        $json=[regex]::Match($response.Html,'<script type="application/ld\+json" id="site-structured-data">([\s\S]*?)</script>').Groups[1].Value | ConvertFrom-Json
        Assert-Seo ($json.'@type' -eq 'WebSite' -and $json.url -eq ('https://'+$canonicalHost+'/')) 'Invalid domain structured data.'
        Assert-Seo ($json.publisher.logo.StartsWith('https://'+$canonicalHost+'/')) 'Structured logo must use the correct domain.'
        Assert-Seo ([regex]::IsMatch($response.Html,'<meta name="description" content="[^"]{50,}"')) 'Missing useful description.'
        $count++
    }
    foreach ($path in @('robots.txt','sitemap.xml','gioi-thieu')) {
        $matched=$null
        foreach ($rule in $rewrite.rules.rule) {
            if ([string]$rule.name -notmatch 'public SEO files|public introduction') {continue}
            $captures=[regex]::Match($path,[string]$rule.match.url)
            if (-not $captures.Success -or -not (Match-Seo $rule.conditions @{'{HTTP_HOST}'=$domain})) {continue}
            $matched=([string]$rule.action.url).Replace('{R:1}',$captures.Groups[1].Value);break
        }
        Assert-Seo ([bool]$matched) ('Missing public route: '+$path)
        $file=Join-Path $app $matched
        Assert-Seo (Test-Path -LiteralPath $file -PathType Leaf) ('Missing route target: '+$matched)
        $body=[IO.File]::ReadAllText($file)
        if ($path -eq 'sitemap.xml') {
            [xml]$map=$body
            $locations=@($map.urlset.url | ForEach-Object { [string]$_.loc })
            Assert-Seo ($locations.Count -eq 2 -and $locations[0] -eq ('https://'+$canonicalHost+'/') -and $locations[1] -eq ('https://'+$canonicalHost+'/gioi-thieu')) 'Sitemap must contain only public URLs for this domain.'
        } elseif ($path -eq 'robots.txt') {
            Assert-Seo ($body.Contains('Sitemap: https://'+$canonicalHost+'/sitemap.xml') -and -not $body.Contains('Disallow: /assets')) 'Robots must link the correct sitemap and allow render resources.'
        } else {
            Assert-Seo ($body.Contains('href="https://'+$canonicalHost+'/gioi-thieu"') -and [regex]::Matches($body,'<h1>').Count -eq 1) 'Public introduction needs a unique canonical and heading.'
        }
        $count++
    }
}
$verification=Get-Content -LiteralPath (Join-Path $app 'googlee681f7a21f5f3fd4.html') -Raw
Assert-Seo ($verification.Trim() -eq 'google-site-verification: googlee681f7a21f5f3fd4.html') 'Google verification file differs from the supplied proof.'
Write-Output ('PASS: '+$count+' domain metadata, canonical, privacy and crawl-resource cases; verification file intact.')
