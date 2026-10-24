[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')][string]$Repository = 'longnt0712/pk-system',
    [string]$InstallDirectory = 'C:\pk-deploy\backend-release',
    [string]$ExpectedComputer = '118-27-192-59',
    [string]$BackendDirectory = 'C:\richy-wine-service',
    [ValidateRange(1, 65535)][int]$Port = 8085,
    [string]$HealthCheckUri = 'http://127.0.0.1:8085/service/api/topic/get_one/1',
    [Security.SecureString]$Token,
    [string]$TaskName = 'PK System Backend Release Deploy'
)

# Run in an elevated Windows PowerShell window on the production server.
# Enter the GitHub PAT only at the secure prompt, never in chat or command history.
$ErrorActionPreference = 'Stop'

function Set-BackendReleaseDirectoryAcl([string]$Path) {
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $administrators = New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')
    $system = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
    $acl.SetOwner($administrators)
    $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    $propagation = [Security.AccessControl.PropagationFlags]::None
    foreach ($identity in @($administrators, $system)) {
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity,
            [Security.AccessControl.FileSystemRights]::FullControl, $inheritance, $propagation,
            [Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Get-BackendReleaseSecureToken([Security.SecureString]$SecureToken) {
    $pointer = [IntPtr]::Zero
    try {
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally { if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) } }
}

function Get-BackendReleaseRuntimeItems([string]$Path) {
    # Enumerate explicitly so junctions are rejected before following or writing them.
    foreach ($item in @(Get-ChildItem -LiteralPath $Path -Force)) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Runtime contains a reparse point; remove it before installation.' }
        $item
        if ($item.PSIsContainer) { Get-BackendReleaseRuntimeItems $item.FullName }
    }
}

function Set-BackendReleaseFileAcl([string]$Path) {
    $acl = Get-Acl -LiteralPath $Path
    $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
    $acl.SetAccessRuleProtection($false, $false)
    foreach ($rule in @($acl.Access | Where-Object { -not $_.IsInherited })) { $acl.RemoveAccessRuleSpecific($rule) }
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Test-BackendReleaseRepository([string]$RepositoryName, [string]$PlainToken) {
    # No redirects: an API token must never be sent to any other host.
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $request = [Net.HttpWebRequest]::Create('https://api.github.com/repos/' + $RepositoryName)
    $request.Method = 'GET'
    $request.AllowAutoRedirect = $false
    $request.Timeout = 60000
    $request.ReadWriteTimeout = 60000
    $request.UserAgent = 'PK-System-Backend-Release-Installer/1'
    $request.Accept = 'application/vnd.github+json'
    $request.Headers['Authorization'] = 'Bearer ' + $PlainToken
    $request.Headers['X-GitHub-Api-Version'] = '2022-11-28'
    $response = $null
    try {
        try { $response = $request.GetResponse() }
        catch [Net.WebException] {
            $status = ''
            if ($_.Exception.Response) {
                $status = ' (HTTP ' + [int]$_.Exception.Response.StatusCode + ')'
                $_.Exception.Response.Dispose()
            }
            throw ('GitHub token/repository verification failed' + $status + '. Check repository access and connectivity.')
        }
        if ([int]$response.StatusCode -ne 200) { throw 'GitHub repository verification did not return HTTP 200. Redirects are not allowed.' }
        $stream = $response.GetResponseStream()
        $reader = New-Object IO.StreamReader($stream)
        try { $repositoryInfo = $reader.ReadToEnd() | ConvertFrom-Json }
        finally { $reader.Dispose(); $stream.Dispose() }
        if ($repositoryInfo.full_name -ine $RepositoryName -or $repositoryInfo.private -isnot [bool] -or -not $repositoryInfo.private) {
            throw 'Backend releases require the configured private GitHub repository.'
        }
    } finally { if ($response) { $response.Dispose() } }
}

if ($env:COMPUTERNAME -ine $ExpectedComputer) { throw ('Install this task on ' + $ExpectedComputer + '.') }
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run PowerShell as Administrator.' }
foreach ($command in @('Register-ScheduledTask', 'Get-ScheduledTask')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw ('Required Windows Server 2012 R2 ScheduledTasks command is missing: ' + $command) }
}
foreach ($path in @($InstallDirectory, $BackendDirectory)) {
    if (-not [IO.Path]::IsPathRooted($path) -or $path -match '[\r\n\"]') { throw 'Installation and backend directories must be safe absolute paths.' }
}
$InstallDirectory = [IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')
$BackendDirectory = [IO.Path]::GetFullPath($BackendDirectory).TrimEnd('\')
if ($InstallDirectory -eq [IO.Path]::GetPathRoot($InstallDirectory).TrimEnd('\') -or
    $InstallDirectory -ieq $BackendDirectory -or $BackendDirectory.StartsWith($InstallDirectory + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Choose a dedicated deployment directory outside the backend directory and its parents.'
}
$healthUri = $null
if (-not [Uri]::TryCreate($HealthCheckUri, [UriKind]::Absolute, [ref]$healthUri) -or
    $healthUri.Scheme -ne 'http' -or $healthUri.Host -cne '127.0.0.1' -or $healthUri.Port -ne $Port -or
    $healthUri.UserInfo -or $healthUri.Fragment) { throw 'Health check must use http://127.0.0.1 on the configured backend port.' }
if (-not (Test-Path -LiteralPath (Join-Path $BackendDirectory 'richy-wine-exec.jar') -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path $BackendDirectory 'richy-wine-service.exe') -PathType Leaf)) { throw 'The existing backend JAR or service wrapper is missing.' }
$sourceReset = Join-Path $PSScriptRoot 'Reset-RichyService.ps1'
$sourceUpdater = Join-Path $PSScriptRoot 'Update-BackendRelease.ps1'
foreach ($source in @($sourceReset, $sourceUpdater)) {
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw ('Required runtime script is missing: ' + $source) }
}
$resetSource = [IO.File]::ReadAllText($sourceReset)
foreach ($required in @('ReplacementJarPath', 'ExpectedSha256', 'HealthCheckUri')) {
    if ($resetSource -notmatch ('\$' + $required + '\b')) { throw ('Reset-RichyService.ps1 lacks required deployment support: ' + $required) }
}
$installMutex = New-Object Threading.Mutex($false, 'Global\PkSystemBackendReleaseUpdate')
$installLocked = $false
try {
try { $installLocked = $installMutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $installLocked = $true }
if (-not $installLocked) { throw 'A backend release poll is running. Wait for it to finish, then rerun the installer.' }
if (Test-Path -LiteralPath $InstallDirectory) {
    $directoryItem = Get-Item -LiteralPath $InstallDirectory
    if (-not $directoryItem.PSIsContainer -or ($directoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Installation directory must be a normal directory, not a file or reparse point.'
    }
} else { New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null }
# Protect this dedicated directory only. Do not change permissions on C:\pk-deploy.
$runtimeItems = @(Get-BackendReleaseRuntimeItems $InstallDirectory)
Set-BackendReleaseDirectoryAcl $InstallDirectory
foreach ($item in $runtimeItems) {
    if ($item.PSIsContainer) { Set-BackendReleaseDirectoryAcl $item.FullName }
    else { Set-BackendReleaseFileAcl $item.FullName }
}
$tokenPath = Join-Path $InstallDirectory 'github-token.bin'
$plainToken = $null
$tokenBytes = $null
Add-Type -AssemblyName System.Security
try {
    if ($Token) { $plainToken = Get-BackendReleaseSecureToken $Token }
    elseif (Test-Path -LiteralPath $tokenPath -PathType Leaf) {
        $tokenBytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($tokenPath), $null,
            [Security.Cryptography.DataProtectionScope]::LocalMachine)
        $plainToken = [Text.Encoding]::UTF8.GetString($tokenBytes)
    } else {
        $Token = Read-Host 'GitHub fine-grained PAT (private repository Contents: Read-only)' -AsSecureString
        $plainToken = Get-BackendReleaseSecureToken $Token
    }
    if ([string]::IsNullOrWhiteSpace($plainToken) -or $plainToken -match '[\r\n]') { throw 'GitHub PAT is empty or invalid.' }
    Test-BackendReleaseRepository $Repository $plainToken
    if (-not $tokenBytes) { $tokenBytes = [Text.Encoding]::UTF8.GetBytes($plainToken) }
    $encrypted = [Security.Cryptography.ProtectedData]::Protect($tokenBytes, $null,
        [Security.Cryptography.DataProtectionScope]::LocalMachine)
    [IO.File]::WriteAllBytes($tokenPath, $encrypted)
} finally {
    if ($tokenBytes) { [Array]::Clear($tokenBytes, 0, $tokenBytes.Length) }
    $plainToken = $null
}
$installedReset = Join-Path $InstallDirectory 'Reset-RichyService.ps1'
$installedUpdater = Join-Path $InstallDirectory 'Update-BackendRelease.ps1'
if ([IO.Path]::GetFullPath($sourceReset) -ine $installedReset) { Copy-Item -LiteralPath $sourceReset -Destination $installedReset -Force }
if ([IO.Path]::GetFullPath($sourceUpdater) -ine $installedUpdater) { Copy-Item -LiteralPath $sourceUpdater -Destination $installedUpdater -Force }
$configPath = Join-Path $InstallDirectory 'settings.json'
$config = [ordered]@{ repository=$Repository; tokenPath=$tokenPath; backendDirectory=$BackendDirectory;
    expectedComputer=$ExpectedComputer; port=$Port; healthCheckUri=$HealthCheckUri; resetScriptPath=$installedReset }
[IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
# Reapply protected ACLs to any pre-existing runtime children, including a reused token.
foreach ($item in @(Get-BackendReleaseRuntimeItems $InstallDirectory)) {
    if ($item.PSIsContainer) { Set-BackendReleaseDirectoryAcl $item.FullName }
    else { Set-BackendReleaseFileAcl $item.FullName }
}
$taskArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $installedUpdater + '" -ConfigPath "' + $configPath + '"'
$xmlArguments = [Security.SecurityElement]::Escape($taskArguments)
$xmlWorkingDirectory = [Security.SecurityElement]::Escape($InstallDirectory)
$boundary = (Get-Date).AddMinutes(1).ToString('yyyy-MM-ddTHH:mm:ss')
$taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Poll private GitHub backend releases and deploy a verified Java 8 JAR through the existing service.</Description></RegistrationInfo>
  <Triggers><TimeTrigger><Repetition><Interval>PT1M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition><StartBoundary>$boundary</StartBoundary><Enabled>true</Enabled></TimeTrigger></Triggers>
  <Principals><Principal id="System"><UserId>S-1-5-18</UserId><LogonType>ServiceAccount</LogonType><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
  <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable><Enabled>true</Enabled><ExecutionTimeLimit>PT20M</ExecutionTimeLimit></Settings>
  <Actions Context="System"><Exec><Command>powershell.exe</Command><Arguments>$xmlArguments</Arguments><WorkingDirectory>$xmlWorkingDirectory</WorkingDirectory></Exec></Actions>
</Task>
"@
Register-ScheduledTask -TaskName $TaskName -Xml $taskXml -Force | Out-Null
Write-Host ('Scheduled task installed: ' + $TaskName + ' (SYSTEM, every minute; no immediate run requested).')
Write-Host 'Private repository access was verified. The first scheduled poll may deploy the newest complete backend release.'
Write-Host ('Verify without deployment: powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $installedUpdater + '" -ConfigPath "' + $configPath + '" -CheckOnly')
Write-Host ('Logs and state: ' + $InstallDirectory)
} finally {
    if ($installLocked) { $installMutex.ReleaseMutex() }
    $installMutex.Dispose()
}
