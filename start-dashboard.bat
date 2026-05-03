@echo off
setlocal
cd /d "%~dp0"
set "NODE_EXE=C:\Users\ameyb\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "PORT=3000"
echo Starting Election Live Dashboard...
echo.
echo Open this URL after the server starts:
echo http://127.0.0.1:3000/
echo.
if exist "%NODE_EXE%" (
  "%NODE_EXE%" server.js
) else (
  node server.js
)
pause
