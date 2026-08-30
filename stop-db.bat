@echo off
if exist "%~dp0pgsql\bin\pg_ctl.exe" (
  "%~dp0pgsql\bin\pg_ctl.exe" -D "%~dp0pgdata" stop
  echo Portable Postgres stopped
  goto :eof
)
docker compose down
pause
