@echo off
title Chess Trainer Pro - Live Runner
color 0A
cls
echo ========================================================
echo         CHESS TRAINER PRO - 1-CLICK LAUNCHER
echo ========================================================
echo.
echo [1/3] Checking environment...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [2/3] Opening browser at http://127.0.0.1:3000 ...
timeout /t 2 /nobreak >nul
start http://127.0.0.1:3000

echo [3/3] Starting Chess Trainer server...
echo.
echo --------------------------------------------------------
echo Local URL: http://127.0.0.1:3000/
echo Extension Folder: %~dp0extension
echo Press Ctrl+C in this window to stop the server.
echo --------------------------------------------------------
echo.

call npx vite --host 127.0.0.1 --port 3000
pause

