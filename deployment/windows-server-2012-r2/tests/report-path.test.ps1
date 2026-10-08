# Run with Windows PowerShell: powershell -NoProfile -File .\report-path.test.ps1
# Execute the production scripts in isolated folders, without reading real services.
$ErrorActionPreference = 'Stop'
$productionDirectory = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$fixtureDirectory = Join-Path ([IO.Path]::GetTempPath()) ('pk-system-report-path-' + [Guid]::NewGuid().ToString('N'))
$fixtureDirectory = [IO.Path]::GetFullPath($fixtureDirectory)
New-Item -ItemType Directory -Path $fixtureDirectory | Out-Null
$callerDirectory = Join-Path $fixtureDirectory 'caller'
New-Item -ItemType Directory -Path $callerDirectory | Out-Null

function Assert-Report([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw ('Missing report: ' + $Path) }
    $content = Get-Content -LiteralPath $Path -Raw
    if ([string]::IsNullOrWhiteSpace($content)) { throw ('Empty report: ' + $Path) }
    if ($content -match 'fixture-secret|fixture-token') { throw ('Credential redaction failed: ' + $Path) }
}

try {
    foreach ($mode in @('normal', 'empty-script-root')) {
        $caseDirectory = Join-Path $fixtureDirectory $mode
        New-Item -ItemType Directory -Path $caseDirectory | Out-Null
        $injected = @'
$ErrorActionPreference = 'Stop'
function Get-NetTCPConnection { return @() }
function Get-CimInstance { return @() }
'@
        if ($mode -eq 'empty-script-root') { $injected += "`n`$PSScriptRoot = ''" }
        foreach ($name in @('Collect-BackendHangDiagnostics.ps1', 'Collect-BackendSaveLogs.ps1')) {
            $source = Get-Content -LiteralPath (Join-Path $productionDirectory $name) -Raw
            $source = $source.Replace('$ErrorActionPreference = ''Stop''', $injected)
            Set-Content -LiteralPath (Join-Path $caseDirectory $name) -Value $source -Encoding UTF8
        }
        Set-Content -LiteralPath (Join-Path $caseDirectory 'richy-wine-service.out.log') `
            -Value 'password=fixture-secret access_token=fixture-token' -Encoding UTF8
        Push-Location $callerDirectory
        try {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $caseDirectory 'Collect-BackendHangDiagnostics.ps1') `
                -BackendDirectory $caseDirectory -Port 65099
            if ($LASTEXITCODE -ne 0) { throw ('Hang collector failed: ' + $mode) }
            Assert-Report (Join-Path $caseDirectory 'backend-hang-diagnostics.txt')
            Assert-Report (Join-Path $caseDirectory 'backend-save-log.txt')

            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $caseDirectory 'Collect-BackendSaveLogs.ps1') `
                -BackendDirectory $caseDirectory -Port 65099
            if ($LASTEXITCODE -ne 0) { throw ('Standalone log collector failed: ' + $mode) }
            Assert-Report (Join-Path $caseDirectory 'backend-save-log.txt')

            $explicitReport = Join-Path $callerDirectory ($mode + '-explicit.txt')
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $caseDirectory 'Collect-BackendHangDiagnostics.ps1') `
                -BackendDirectory $caseDirectory -Port 65099 -ReportPath $explicitReport
            if ($LASTEXITCODE -ne 0) { throw ('Explicit report path failed: ' + $mode) }
            Assert-Report $explicitReport
            Assert-Report (Join-Path $callerDirectory 'backend-save-log.txt')
            Write-Output ('PASS: ' + $mode + ' defaults, sibling collector and explicit path from another working directory.')
        } finally { Pop-Location }
    }
} finally {
    # Verify the absolute recursive cleanup target remains in this test's temp root.
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $fixtureDirectory.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path -Leaf $fixtureDirectory) -notmatch '^pk-system-report-path-[0-9a-f]{32}$') {
        throw 'Refusing to clean an unexpected fixture directory.'
    }
    Remove-Item -LiteralPath $fixtureDirectory -Recurse -Force
}
