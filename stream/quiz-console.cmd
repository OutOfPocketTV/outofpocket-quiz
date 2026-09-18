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

REM Asks the way a panel actually connects -- 127.0.0.1:4700 -- rather than
REM reading netstat for one exact bind address. START SHOW binds the relay to
REM 0.0.0.0 for the iPad, which netstat never lists as 127.0.0.1, so the old
REM check decided a running relay was down and started a SECOND one: the
REM silent split where half the panels talk to each relay.
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient).Connect('127.0.0.1', 4700); exit 0 } catch { exit 1 }" >nul 2>&1
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
