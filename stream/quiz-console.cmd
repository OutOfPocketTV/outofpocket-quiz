@echo off
REM Opens the quiz console in its own chromeless window.
REM This window is for YOU -- it is deliberately never captured by OBS.
REM What the audience sees is the "Quiz Card" browser source, which the
REM console drives through the relay.
REM
REM The console is useless without the relay, and a dead relay shows up as
REM nothing more than a small red dot -- so start it here if it isn't
REM already listening. That makes this the single thing to click at the top
REM of a stream.

setlocal

netstat -ano | findstr /R /C:"TCP.*127.0.0.1:4700.*LISTENING" >nul 2>&1
if errorlevel 1 (
  echo   Relay isn't running -- starting it first...
  start "" "%~dp0start-stream-kit.cmd"
  REM Give node time to bind the port before the console asks for state.
  timeout /t 5 /nobreak >nul
)

set "CHROME="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do if exist %%P set "CHROME=%%P"

if not defined CHROME (
  echo Could not find Chrome. Open this manually instead:
  echo   http://127.0.0.1:4700/console.html
  pause
  exit /b 1
)

start "" %CHROME% --app=http://127.0.0.1:4700/console.html --window-size=560,860
