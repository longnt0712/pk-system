@echo off
setlocal
rem Build locally and publish a private GitHub release for the server poller.
rem Authenticate once with gh auth login. No password or token belongs here.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Build-PublishBackend.ps1" -Publish %*
set "backend_exit=%ERRORLEVEL%"
if not "%backend_exit%"=="0" echo Backend build/publication failed. Read the message above; no server action was performed.
exit /b %backend_exit%
