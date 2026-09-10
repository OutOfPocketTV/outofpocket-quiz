@echo off
title Out Of Pocket -- stream relay (LAN mode, for the iPad)
cd /d "%~dp0.."

REM Same relay as start-stream-kit.cmd, bound to every interface instead of
REM loopback only, so the iPad can reach /ipad.html over the WiFi.
REM
REM DELIBERATELY A SEPARATE FILE. The relay has NO authentication -- every
REM control route (/reset, /quiz, /settings, /chat, /music) is open to whoever
REM can reach the port. On loopback that is nobody but this PC. On the LAN it
REM is anyone on the WiFi, who can then drive what is on air mid-stream.
REM
REM So: use this launcher only when the iPad prop is actually in the show, use
REM start-stream-kit.cmd the rest of the time, and keep the WiFi password to
REM yourself. The firewall rule this needs is private-profile only:
REM
REM   netsh advfirewall firewall add rule name="OOP relay 4700" ^
REM     dir=in action=allow protocol=TCP localport=4700 profile=private
REM
REM 127.0.0.1 still works exactly as before -- 0.0.0.0 includes loopback, so
REM every existing OBS browser source and the console are unaffected.

set OOP_STREAM_HOST=0.0.0.0

echo.
echo   Starting the Out Of Pocket stream relay in LAN mode...
echo   Leave this window open for the whole stream.
echo.

for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4 Address" ^| findstr /V "192.168.56"') do (
  for /f "tokens=* delims= " %%B in ("%%A") do (
    echo   iPad:  http://%%B:4700/ipad.html
  )
)
echo.

start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://127.0.0.1:4700/"

node stream\relay.js

echo.
echo   The relay has stopped. Press any key to close this window.
pause >nul
