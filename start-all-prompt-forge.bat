@echo off
setlocal
echo === Prompt Forge (full) - DB + App ===
if exist "%~dp0pgsql\bin\pg_ctl.exe" (
  "%~dp0pgsql\bin\pg_ctl.exe" -D "%~dp0pgdata" status >nul 2>&1
  if errorlevel 1 (
    echo Starting Portable Postgres...
    "%~dp0pgsql\bin\pg_ctl.exe" -D "%~dp0pgdata" -l "%~dp0pgdata\logfile" start
    timeout /t 3 >nul
  ) else echo Postgres already running
  set "PATH=%~dp0pgsql\bin;%PATH%"
) else docker compose up -d
echo DB at localhost:5432
echo Starting Prompt Forge at http://localhost:3000 ...
cd /d "%~dp0"
call npm run dev
pause
