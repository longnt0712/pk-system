# Run with Windows PowerShell; uses a fake sqlcmd and never connects to SQL Server.
$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'Backup-Ecommerce.bat'
$source = [IO.File]::ReadAllText($scriptPath)
$testTempRoot = Join-Path (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))) '.tmp'
$fixtureRoot = Join-Path $testTempRoot ('pk-backup-test-' + [Guid]::NewGuid().ToString('N'))
$fixtureRoot = [IO.Path]::GetFullPath($fixtureRoot)
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
$fakeSqlcmd = Join-Path $fixtureRoot 'fake sqlcmd.exe'
$originalPassword = $env:SQLCMDPASSWORD
$originalMode = $env:PK_BACKUP_TEST_MODE
$originalEvents = $env:PK_BACKUP_TEST_EVENTS

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

try {
    Add-Type -OutputAssembly $fakeSqlcmd -OutputType ConsoleApplication -TypeDefinition @'
using System;
using System.IO;
using System.Text.RegularExpressions;
public static class FakeSqlcmd {
    public static int Main(string[] args) {
        try {
            int queryIndex = Array.IndexOf(args, "-Q");
            string query = args[queryIndex + 1];
            if (Array.IndexOf(args, "-P") >= 0 || String.IsNullOrEmpty(Environment.GetEnvironmentVariable("SQLCMDPASSWORD"))) return 8;
            if (Array.IndexOf(args, "-b") < 0 || Array.IndexOf(args, "-x") < 0) return 9;
            File.AppendAllText(Environment.GetEnvironmentVariable("PK_BACKUP_TEST_EVENTS"), query + Environment.NewLine);
            string mode = Environment.GetEnvironmentVariable("PK_BACKUP_TEST_MODE");
            string path = Regex.Match(query, "DISK = N'((?:''|[^'])*)'").Groups[1].Value.Replace("''", "'");
            if (query.StartsWith("BACKUP DATABASE [ecommerce]")) {
                File.WriteAllText(path, "fake backup; not SQL data");
                if (!query.Contains("COPY_ONLY, CHECKSUM")) return 10;
                return mode == "backup-failure" ? 1 : 0;
            }
            if (query.StartsWith("RESTORE VERIFYONLY")) {
                if (!File.Exists(path) || !query.Contains("CHECKSUM, STOP_ON_ERROR")) return 11;
                return mode == "verify-failure" ? 1 : 0;
            }
            return 12;
        } catch (Exception error) {
            Console.Error.WriteLine(error.Message);
            return 13;
        }
    }
}
'@

    foreach ($mode in @('success', 'backup-failure', 'verify-failure', 'cleanup-failure', 'missing-password')) {
        $caseRoot = Join-Path $fixtureRoot $mode
        $backupRoot = Join-Path $caseRoot "O'Brien & backups!"
        New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
        $caseScript = Join-Path $caseRoot 'Backup-Ecommerce.bat'
        $caseSource = $source.Replace('set "BACKUP_DIR=C:\SQLBackups\ecommerce"', ('set "BACKUP_DIR=' + $backupRoot + '"'))
        $caseSource = $caseSource.Replace('set "SQLCMD_EXE=sqlcmd.exe"', ('set "SQLCMD_EXE=' + $fakeSqlcmd + '"'))
        [IO.File]::WriteAllText($caseScript, ($caseSource -replace '\r?\n', "`r`n"), [Text.Encoding]::ASCII)
        foreach ($day in 1..12) {
            $name = 'ecommerce_199901{0:00}_030000_000.bak' -f $day
            [IO.File]::WriteAllText((Join-Path $backupRoot $name), 'existing verified backup')
        }
        $foreign = @('church_19990101_030000_000.bak', 'ecommerce_manual.bak')
        foreach ($name in $foreign) { [IO.File]::WriteAllText((Join-Path $backupRoot $name), 'keep') }
        $childRoot = Join-Path $backupRoot 'nested'
        New-Item -ItemType Directory -Path $childRoot | Out-Null
        $childBackup = Join-Path $childRoot 'ecommerce_19990101_030000_000.bak'
        [IO.File]::WriteAllText($childBackup, 'keep')
        $env:SQLCMDPASSWORD = 'fixture-only%!' + [char]34 + '&value'
        if ($mode -eq 'missing-password') { $env:SQLCMDPASSWORD = $null }
        $env:PK_BACKUP_TEST_MODE = $mode
        $env:PK_BACKUP_TEST_EVENTS = Join-Path $caseRoot 'events.txt'
        $lock = $null
        if ($mode -eq 'cleanup-failure') {
            $lock = [IO.File]::Open((Join-Path $backupRoot 'ecommerce_19990103_030000_000.bak'), 'Open', 'Read', 'None')
        }
        Push-Location $caseRoot
        try {
            & cmd.exe /d /c 'Backup-Ecommerce.bat > test-output.txt 2>&1'
            $result = $LASTEXITCODE
            $output = [IO.File]::ReadAllText((Join-Path $caseRoot 'test-output.txt'))
        } finally {
            Pop-Location
            if ($null -ne $lock) { $lock.Dispose() }
        }
        $backups = @(Get-ChildItem -LiteralPath $backupRoot -File | Where-Object { $_.Name -match '^ecommerce_[0-9]{8}_[0-9]{6}_[0-9]{3}\.bak$' })
        $pending = @(Get-ChildItem -LiteralPath $backupRoot -File -Filter '*.pending')
        $queries = @()
        if (Test-Path -LiteralPath $env:PK_BACKUP_TEST_EVENTS) { $queries = @(Get-Content -LiteralPath $env:PK_BACKUP_TEST_EVENTS) }
        $expectedCount = 12
        if ($mode -eq 'success') { $expectedCount = 10 }
        if ($mode -eq 'cleanup-failure') { $expectedCount = 13 }
        $logText = @(Get-ChildItem -LiteralPath $backupRoot -Recurse -Filter '*.log' | ForEach-Object { [IO.File]::ReadAllText($_.FullName) }) -join "`n"
        Assert-True ($backups.Count -eq $expectedCount) ("Wrong retention result for ${mode}: " + $output + $logText)
        Assert-True ($pending.Count -eq 0) ('Incomplete backup left behind: ' + $mode)
        if ($mode -eq 'success') {
            Assert-True ($result -eq 0) ('Success returned a failure: ' + $output)
            Assert-True (-not (Test-Path -LiteralPath (Join-Path $backupRoot 'ecommerce_19990103_030000_000.bak'))) 'Oldest files were not pruned.'
            Assert-True (Test-Path -LiteralPath (Join-Path $backupRoot 'ecommerce_19990104_030000_000.bak')) 'A required recent backup was pruned.'
        } else {
            Assert-True ($result -eq 1) ('Failure was not reported: ' + $mode)
        }
        $expectedQueries = 2
        if ($mode -eq 'backup-failure') { $expectedQueries = 1 }
        if ($mode -eq 'missing-password') { $expectedQueries = 0 }
        Assert-True ($queries.Count -eq $expectedQueries) ('Unexpected SQL calls: ' + $mode)
        foreach ($name in $foreign) {
            Assert-True (Test-Path -LiteralPath (Join-Path $backupRoot $name)) ('Unrelated file deleted: ' + $name)
        }
        Assert-True (Test-Path -LiteralPath $childBackup) 'Cleanup entered a child directory.'
        Write-Output ('PASS: ' + $mode)
    }
} finally {
    $env:SQLCMDPASSWORD = $originalPassword
    $env:PK_BACKUP_TEST_MODE = $originalMode
    $env:PK_BACKUP_TEST_EVENTS = $originalEvents
    $tempPrefix = [IO.Path]::GetFullPath($testTempRoot).TrimEnd('\') + '\'
    if (-not $fixtureRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path -Leaf $fixtureRoot) -notmatch '^pk-backup-test-[0-9a-f]{32}$') {
        throw 'Refusing to clean an unexpected fixture directory.'
    }
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
}
