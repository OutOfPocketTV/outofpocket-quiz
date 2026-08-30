@echo off
REM Opens the stream control panel in its own chromeless window.
REM
REM This is the desk-side panel -- the tally, the test alerts, the "was a
REM girl / was a guy" fixes. Nothing here is captured by OBS, so it is safe
REM to leave open on the second monitor for the whole show.
REM
REM Same shape as quiz-console.cmd: the panel is useless without the relay,
REM and a dead relay shows up as nothing more than a small red dot, so start
REM the relay here if it isn't already listening. That makes this one thing
REM to click, whether or not anything else is running yet.

setlocal

netstat -ano | findstr /R /C:"TCP.*127.0.0.1:4700.*LISTENING" >nul 2>&1
if errorlevel 1 (
  echo   Relay isn't running -- starting it first...
  start "" "%~dp0start-stream-kit.cmd"
  REM Give node time to bind the port before the panel asks for state.
  timeout /t 5 /nobreak >nul
)

set "CHROME="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do if exist %%P set "CHROME=%%P"

REM Wide enough for the three panels to sit side by side rather than stacking.
if defined CHROME (
  start "" %CHROME% --app=http://127.0.0.1:4700/ --window-size=1320,960
) else (
  REM No Chrome: the default browser does the job, it just gets a tab bar.
  start "" http://127.0.0.1:4700/
)
