@echo off
REM Out Of Pocket -- the one thing to click at the top of a stream.
REM
REM Starts the relay bound to the LAN (so the iPad can reach it), opens the
REM operator console, and prints the iPad's URL. Close the window it opens to
REM end the show.
REM
REM The real work is in start-show.ps1 -- batch cannot do the "kill the
REM relay that is already listening, by PID, only if it is node" part without
REM turning into line noise.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-show.ps1"
