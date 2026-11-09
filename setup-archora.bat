@echo off
setlocal
cd /d "%~dp0"
title Archora Studio Setup

echo Starting Archora Studio Setup...
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%ROOT_DIR%\scripts\setup-archora.ps1" -ProjectRoot "%ROOT_DIR%"
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% NEQ 0 (
    echo.
    echo [ERROR] Setup encountered an issue with exit code %EXIT_CODE%.
    echo Please review the messages above.
    pause
)

exit /b %EXIT_CODE%
