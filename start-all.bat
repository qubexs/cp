@echo off
setlocal
echo === Cinematic Prompt Lab - DB + App ===
if exist "%~dp0pgsql\bin\pg_ctl.exe" (
  "%~dp0pgsql\bin\pg_ctl.exe" -D "%~dp0pgdata" status >nul 2>&1
  if errorlevel 1 (
    echo Starting Portable Postgres...
    "%~dp0pgsql\bin\pg_ctl.exe" -D "%~dp0pgdata" -l "%~dp0pgdata\logfile" start
    timeout /t 3 >nul
  ) else echo Postgres already running
  set "PATH=%~dp0pgsql\bin;%PATH%"
  "%~dp0pgsql\bin\psql.exe" -U postgres -c "SELECT version();" >nul 2>&1
  if errorlevel 1 echo WARNING: DB not ready yet
) else (
  echo Starting Docker Postgres...
  docker compose up -d
)
echo DB at localhost:5432 promptforge/promptforge_local_pw
echo Starting Cinematic (standalone) at http://localhost:3000 ...
cd /d "%~dp0Cinematic"
call npm run dev
pause
