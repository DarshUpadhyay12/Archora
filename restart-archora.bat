@echo off
setlocal
cd /d "%~dp0"
title Restart Archora Architecture Studio

echo ==============================================================
echo   RESTARTING ARCHORA ARCHITECTURE STUDIO
echo ==============================================================
echo.
echo Stopping running services...
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\stop-archora.ps1" -ProjectRoot "%~dp0"

timeout /t 2 >nul

echo.
echo Starting fresh services...
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\start-archora.ps1" -ProjectRoot "%~dp0"
set EXIT_CODE=%ERRORLEVEL%

timeout /t 5 >nul
exit /b %EXIT_CODE%

