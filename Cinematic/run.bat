@echo off
echo Starting Cinematic Prompt Lab (Turbopack) - standalone...
if exist "%~dp0..\pgsql\bin\pg_ctl.exe" (
  "%~dp0..\pgsql\bin\pg_ctl.exe" -D "%~dp0..\pgdata" status >nul 2>&1
  if errorlevel 1 (
    echo Starting Portable Postgres...
    "%~dp0..\pgsql\bin\pg_ctl.exe" -D "%~dp0..\pgdata" -l "%~dp0..\pgdata\logfile" start
    timeout /t 3 >nul
  ) else echo Postgres already running
  set "PATH=%~dp0..\pgsql\bin;%PATH%"
) else if exist "%~dp0..\docker-compose.yml" docker compose -f "%~dp0..\docker-compose.yml" up -d
cd /d "%~dp0"
call npm run dev
pause
