@echo off
setlocal
cd /d "%~dp0"
title Archora Studio - Free Gemini API Key Setup

echo ==============================================================
echo   ARCHORA STUDIO - GEMINI API KEY SETUP
echo ==============================================================
echo.
echo   Get your 100%% FREE Gemini API key in 60 seconds from:
echo   https://aistudio.google.com/
echo.
echo ==============================================================
echo.

set /p USER_KEY="Paste your Gemini API key here and press ENTER: "

if "%USER_KEY%"=="" (
    echo.
    echo [INFO] No key was entered. Your settings remain unchanged.
    echo.
    pause
    exit /b 0
)

powershell.exe -ExecutionPolicy Bypass -NoProfile -Command ^
  "$envPath = Join-Path '%~dp0' '.env';" ^
  "$examplePath = Join-Path '%~dp0' '.env.example';" ^
  "if (-not (Test-Path $envPath) -and (Test-Path $examplePath)) { Copy-Item $examplePath $envPath };" ^
  "if (Test-Path $envPath) {" ^
  "    $lines = Get-Content $envPath;" ^
  "    if ($lines -match '^GEMINI_API_KEY=') {" ^
  "        $lines = $lines -replace '^GEMINI_API_KEY=.*', ('GEMINI_API_KEY=' + '%USER_KEY%');" ^
  "    } else {" ^
  "        $lines = @('GEMINI_API_KEY=%USER_KEY%') + $lines;" ^
  "    }" ^
  "    $lines | Set-Content -Encoding UTF8 $envPath;" ^
  "    Write-Host '[SUCCESS] Your Gemini API key was saved to .env!' -ForegroundColor Green;" ^
  "} else {" ^
  "    @('GEMINI_API_KEY=%USER_KEY%', 'GEMINI_MODEL=gemini-3.5-flash-lite', 'PORT=5000') | Set-Content -Encoding UTF8 $envPath;" ^
  "    Write-Host '[SUCCESS] Created .env and saved your Gemini API key!' -ForegroundColor Green;" ^
  "}"

echo.
echo ==============================================================
echo   DONE! You are ready to launch Archora Studio!
echo ==============================================================
echo.
pause
exit /b 0
