[CmdletBinding()]
param(
    [string]$RepositoryPath = "C:\pk-deploy\pk-system",
    [string]$TaskName = "PK System Frontend Deploy"
)

$ErrorActionPreference = "Stop"
$deployRoot = "C:\pk-deploy"
$sourceScript = Join-Path $RepositoryPath "deployment\windows-server-2012-r2\Update-Frontend.ps1"
$installedScript = Join-Path $deployRoot "Update-Frontend.ps1"

if (-not (Test-Path -LiteralPath $sourceScript -PathType Leaf)) {
    throw "Deployment script was not found: $sourceScript"
}
if (-not (Test-Path -LiteralPath "C:\ielts-clients\app" -PathType Container)) {
    throw "Production frontend directory was not found: C:\ielts-clients\app"
}

Copy-Item -LiteralPath $sourceScript -Destination $installedScript -Force

$taskCommand = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$installedScript`""
& schtasks.exe /Create /TN $TaskName /TR $taskCommand /SC MINUTE /MO 1 /RU SYSTEM /RL HIGHEST /F
if ($LASTEXITCODE -ne 0) {
    throw "Could not create scheduled task (exit code $LASTEXITCODE)."
}

Write-Host "Scheduled task created: $TaskName"
Write-Host "The task checks origin/main every minute and deploys only changes under richy/app."
