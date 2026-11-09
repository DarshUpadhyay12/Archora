@echo off
setlocal
cd /d "%~dp0"
title Stop Archora Architecture Studio

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%ROOT_DIR%\scripts\stop-archora.ps1" -ProjectRoot "%ROOT_DIR%"
set EXIT_CODE=%ERRORLEVEL%
exit /b %EXIT_CODE%
