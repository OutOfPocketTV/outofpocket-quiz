@echo off
title Out Of Pocket -- stream relay
cd /d "%~dp0.."

echo.
echo   Starting the Out Of Pocket stream relay...
echo   Leave this window open for the whole stream.
echo.

REM Give the server a beat to bind the port before the panel opens,
REM otherwise the control panel loads into a connection error.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://127.0.0.1:4700/"

node stream\relay.js

echo.
echo   The relay has stopped. Press any key to close this window.
pause >nul
