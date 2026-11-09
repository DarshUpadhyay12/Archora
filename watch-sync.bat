@echo off
setlocal
cd /d "%~dp0"
title Archora Studio - GitHub Auto Watcher

powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\watch-and-sync.ps1"
pause
