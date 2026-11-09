@echo off
setlocal
cd /d "%~dp0"
title Archora Studio - GitHub Auto-Sync

powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\git-sync.ps1" %*
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% NEQ 0 (
    echo.
    echo [ERROR] Git sync failed with exit code %EXIT_CODE%.
    pause
)
exit /b %EXIT_CODE%
