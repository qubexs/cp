@echo off
if exist "%~dp0pgsql\bin\pg_ctl.exe" (
  "%~dp0pgsql\bin\pg_ctl.exe" -D "%~dp0pgdata" -l "%~dp0pgdata\logfile" start
  echo Portable Postgres at localhost:5432 promptforge/promptforge_local_pw
  timeout /t 3 >nul
  "%~dp0pgsql\bin\psql.exe" -U postgres -c "SELECT version();"
  goto :eof
)
docker compose up -d
echo Postgres at localhost:5432 promptforge/promptforge_local_pw
docker ps | findstr promptforge-db
pause
