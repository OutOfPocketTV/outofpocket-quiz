@echo off
REM Daily #daily-odds run, driven by Windows Task Scheduler.
REM
REM Reveal first, then post: yesterday's answer lands above today's question,
REM so the channel reads in order. Both commands are idempotent -- reveal does
REM nothing if it already ran, post does nothing if today is already up -- so
REM a double-fire or a catch-up run after the machine was off is harmless.
REM
REM Runs as Tom, so DISCORD_BOT_TOKEN comes from the user environment.

cd /d "%~dp0.."

set LOG=%~dp0daily-run.log
echo. >> "%LOG%"
echo ==== %DATE% %TIME% ==== >> "%LOG%"

node discord\daily-odds.js --reveal >> "%LOG%" 2>&1
node discord\daily-odds.js --post   >> "%LOG%" 2>&1

exit /b %ERRORLEVEL%
