@echo off
setlocal EnableExtensions DisableDelayedExpansion
if not exist "%~dp0Reset-RichyService.ps1" (
    echo ERROR: Put Reset-RichyService.ps1 beside this BAT file.
    exit /b 1
)
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0Reset-RichyService.ps1"
exit /b %ERRORLEVEL%
