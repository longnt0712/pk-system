[CmdletBinding()]
param(
    [string]$RepositoryPath = "C:\pk-deploy\pk-system",
    [string]$FrontendPath = "C:\ielts-clients\app",
    [string]$Branch = "main",
    [string]$LogPath = "C:\pk-deploy\frontend-deploy.log",
    [switch]$ForceDeploy
)

$ErrorActionPreference = "Stop"
$gitExe = "C:\Program Files\Git\cmd\git.exe"
$sshExe = "C:/Program Files/Git/usr/bin/ssh.exe"
$deployKey = "C:/pk-deploy/github_deploy_key"
$knownHosts = "C:/pk-deploy/github_known_hosts"
$sourcePath = Join-Path $RepositoryPath "richy\app"
$mutex = New-Object System.Threading.Mutex($false, "Global\PkSystemFrontendDeploy")
$hasMutex = $false

function Write-DeployLog([string]$Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $LogPath -Value "$timestamp $Message" -Encoding UTF8
}

function Invoke-RepoGit([string[]]$Arguments) {
    $gitArguments = @("-c", "safe.directory=$RepositoryPath", "-C", $RepositoryPath) + $Arguments
    $output = & $gitExe @gitArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git failed with exit code ${LASTEXITCODE}: git $($Arguments -join ' ')"
    }
    return $output
}

try {
    $hasMutex = $mutex.WaitOne(0)
    if (-not $hasMutex) { return }

    foreach ($requiredFile in @($gitExe, $deployKey, $knownHosts)) {
        if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
            throw "Required deployment file was not found: $requiredFile"
        }
    }
    foreach ($requiredDirectory in @($RepositoryPath, $sourcePath, $FrontendPath)) {
        if (-not (Test-Path -LiteralPath $requiredDirectory -PathType Container)) {
            throw "Required deployment directory was not found: $requiredDirectory"
        }
    }

    $env:GIT_SSH_COMMAND = "`"$sshExe`" -i $deployKey -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$knownHosts"
    Invoke-RepoGit @("fetch", "--quiet", "--prune", "origin", $Branch) | Out-Null

    $currentCommit = (Invoke-RepoGit @("rev-parse", "HEAD") | Select-Object -Last 1).Trim()
    $targetCommit = (Invoke-RepoGit @("rev-parse", "origin/$Branch") | Select-Object -Last 1).Trim()

    if (-not $ForceDeploy -and $currentCommit -eq $targetCommit) {
        return
    }

    $frontendChanged = $ForceDeploy.IsPresent
    if (-not $frontendChanged) {
        & $gitExe -c "safe.directory=$RepositoryPath" -C $RepositoryPath diff --quiet $currentCommit $targetCommit -- richy/app
        if ($LASTEXITCODE -eq 1) {
            $frontendChanged = $true
        } elseif ($LASTEXITCODE -ne 0) {
            throw "Cannot determine whether frontend files changed."
        }
    }

    Invoke-RepoGit @("reset", "--quiet", "--hard", "origin/$Branch") | Out-Null

    if (-not $frontendChanged) {
        Write-DeployLog "Updated checkout to $targetCommit; frontend was unchanged."
        return
    }

    & robocopy $sourcePath $FrontendPath /E /COPY:DAT /DCOPY:DAT /R:3 /W:2 /XD .git .idea tests node_modules /NFL /NDL /NP
    $robocopyExitCode = $LASTEXITCODE
    if ($robocopyExitCode -ge 8) {
        throw "Robocopy failed with exit code $robocopyExitCode."
    }

    Write-DeployLog "Deployed frontend commit $targetCommit to $FrontendPath."
} catch {
    Write-DeployLog "ERROR: $($_.Exception.Message)"
    exit 1
} finally {
    if ($hasMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}

exit 0
