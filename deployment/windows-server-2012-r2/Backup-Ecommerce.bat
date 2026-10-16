@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Run this file ON the SQL Server machine.
set "SQL_SERVER=.\SQLEXPRESS"
set "SQL_USER=sa"
set "DATABASE=ecommerce"
set "BACKUP_DIR=C:\SQLBackups\ecommerce"
set "KEEP_COUNT=10"
set "SQLCMD_EXE=sqlcmd.exe"
rem Enter the password after = only in the copy kept on the server.
rem In a BAT file, write a literal percent sign as two percent signs.
if not defined SQLCMDPASSWORD set "SQLCMDPASSWORD="

if not defined SQLCMDPASSWORD (
    echo ERROR: Set SQLCMDPASSWORD in this file before scheduling it.
    exit /b 1
)

if exist "%SQLCMD_EXE%" goto sqlcmd_ready
where.exe "%SQLCMD_EXE%" >nul 2>&1
if not errorlevel 1 goto sqlcmd_ready
set "SQLCMD_EXE=%ProgramFiles%\Microsoft SQL Server\100\Tools\Binn\SQLCMD.EXE"
if exist "%SQLCMD_EXE%" goto sqlcmd_ready
set "SQLCMD_EXE=%ProgramFiles(x86)%\Microsoft SQL Server\100\Tools\Binn\SQLCMD.EXE"
if exist "%SQLCMD_EXE%" goto sqlcmd_ready
echo ERROR: sqlcmd.exe was not found. Set SQLCMD_EXE to its full path.
exit /b 1

:sqlcmd_ready
set "STAMP="
for /f %%T in ('powershell.exe -NoLogo -NoProfile -NonInteractive -Command "Get-Date -Format yyyyMMdd_HHmmss_fff"') do set "STAMP=%%T"
if not defined STAMP (
    echo ERROR: Could not generate a backup timestamp with PowerShell.
    exit /b 1
)

if not exist "%BACKUP_DIR%\" mkdir "%BACKUP_DIR%"
if not exist "%BACKUP_DIR%\" (
    echo ERROR: Could not create the backup directory.
    exit /b 1
)
set "LOG_DIR=%BACKUP_DIR%\logs"
if not exist "%LOG_DIR%\" mkdir "%LOG_DIR%"
if not exist "%LOG_DIR%\" (
    echo ERROR: Could not create the log directory.
    exit /b 1
)
set "LOG_FILE=%LOG_DIR%\backup_%STAMP%.log"
set "BACKUP_NAME=%DATABASE%_%STAMP%.bak"
set "BACKUP_FILE=%BACKUP_DIR%\%BACKUP_NAME%"
set "PENDING_FILE=%BACKUP_FILE%.pending"
if exist "%BACKUP_FILE%" (
    echo ERROR: The timestamped backup file already exists.
    exit /b 1
)
if exist "%PENDING_FILE%" (
    echo ERROR: The timestamped pending file already exists.
    exit /b 1
)
> "%LOG_FILE%" echo Starting backup: %DATABASE% at %STAMP%
if errorlevel 1 (
    echo ERROR: Could not write the backup log.
    exit /b 1
)

rem SQL Server writes the file using the SQL Server SERVICE account.
rem Escape apostrophes in the path for the SQL string literal.
set "SQL_BACKUP_FILE=%PENDING_FILE:'=''%"
echo Backing up %DATABASE% ...
"%SQLCMD_EXE%" -S "%SQL_SERVER%" -U "%SQL_USER%" -d master -b -x -r 1 -l 30 -t 0 -Q "BACKUP DATABASE [%DATABASE%] TO DISK = N'%SQL_BACKUP_FILE%' WITH COPY_ONLY, CHECKSUM, STATS = 10;" >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto backup_failed

echo Verifying backup ...
"%SQLCMD_EXE%" -S "%SQL_SERVER%" -U "%SQL_USER%" -d master -b -x -r 1 -l 30 -t 0 -Q "RESTORE VERIFYONLY FROM DISK = N'%SQL_BACKUP_FILE%' WITH CHECKSUM, STOP_ON_ERROR;" >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto backup_failed

rem Only verified backups receive the final .bak extension.
ren "%PENDING_FILE%" "%BACKUP_NAME%" >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto publish_failed

rem Delete only matching backup FILES in this directory; never recurse.
rem Sort the generated timestamped names so copied file dates do not matter.
powershell.exe -NoLogo -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $root=[IO.Path]::GetFullPath($env:BACKUP_DIR); $pattern='^' + [regex]::Escape($env:DATABASE) + '_[0-9]{8}_[0-9]{6}_[0-9]{3}\.bak$'; $old=Get-ChildItem -LiteralPath $root -File -ErrorAction Stop | Where-Object { $_.Name -match $pattern -and -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } | Sort-Object Name -Descending | Select-Object -Skip ([int]$env:KEEP_COUNT); foreach ($file in $old) { Remove-Item -LiteralPath $file.FullName -Force -ErrorAction Stop; Write-Output ('Deleted old backup: ' + $file.Name) }" >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto cleanup_failed

>> "%LOG_FILE%" echo SUCCESS: Backup verified. Kept the latest %KEEP_COUNT% backups.
echo SUCCESS: "%BACKUP_FILE%"
echo Log: "%LOG_FILE%"
exit /b 0

:backup_failed
>> "%LOG_FILE%" echo ERROR: Backup or verification failed. Old backups were kept.
rem Remove only this run's incomplete file, never a previous .bak file.
if exist "%PENDING_FILE%" del /q "%PENDING_FILE%" >> "%LOG_FILE%" 2>&1
echo ERROR: Backup or verification failed. See "%LOG_FILE%"
exit /b 1

:publish_failed
>> "%LOG_FILE%" echo ERROR: Could not rename the verified pending file. Old backups were kept.
echo ERROR: Could not publish the backup. See "%LOG_FILE%"
exit /b 1

:cleanup_failed
>> "%LOG_FILE%" echo ERROR: Backup succeeded but deleting old backups failed.
echo ERROR: Backup succeeded but cleanup failed. See "%LOG_FILE%"
exit /b 1
