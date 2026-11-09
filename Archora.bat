@echo off
setlocal
cd /d "%~dp0"
call "%~dp0start-archora.bat" %*
exit /b %ERRORLEVEL%

