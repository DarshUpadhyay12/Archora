@echo off
setlocal
cd /d "%~dp0"
title Archora Architecture Studio

:: 1. Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo ==============================================================
    echo   [ERROR] Node.js is not installed or not found in PATH.
    echo ==============================================================
    echo   Archora requires Node.js v18 or higher to run.
    echo   Please download and install it from: https://nodejs.org/
    echo   After installing Node.js, double-click this file again.
    echo ==============================================================
    echo.
    pause
    exit /b 1
)

:: 2. Auto-initialize .env from .env.example if missing
if not exist "%~dp0.env" (
    if exist "%~dp0.env.example" (
        copy "%~dp0.env.example" "%~dp0.env" >nul
        echo [Archora] Created default configuration file: .env
    )
)

:: 3. One-Time Setup: If node_modules is missing (freshly cloned from GitHub)
if not exist "%~dp0node_modules" (
    echo.
    echo ==============================================================
    echo   ARCHORA STUDIO - FIRST-TIME SETUP DETECTED
    echo ==============================================================
    echo   Installing project dependencies once. Please wait...
    echo   This is only done ONCE. Future launches will start in 1-2 seconds!
    echo ==============================================================
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Dependency installation failed.
        echo Please check your internet connection and try again.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed successfully.
    echo [Archora] Building frontend interface once...
    call npm run build
    echo.
    echo [Archora] Creating your Windows Desktop shortcut...
    powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\create-shortcut.ps1" -ProjectRoot "%~dp0"
    echo.
    echo ==============================================================
    echo   SETUP COMPLETE! LAUNCHING ARCHORA STUDIO...
    echo ==============================================================
    echo.
)

:: 4. Fast Launch: Start Archora services and open browser
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
if "%~1"=="" (
    powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%ROOT_DIR%\scripts\start-archora.ps1" -ProjectRoot "%ROOT_DIR%" -Interactive
) else (
    powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%ROOT_DIR%\scripts\start-archora.ps1" -ProjectRoot "%ROOT_DIR%" %*
)
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% NEQ 0 (
    echo.
    echo [ERROR] Archora startup failed with exit code %EXIT_CODE%.
    echo Please see docs\WINDOWS_SETUP_GUIDE.md for help.
    echo.
    pause
    exit /b %EXIT_CODE%
)
exit /b 0
