@echo off
docker compose up -d
echo Postgres at localhost:5432 promptforge/promptforge_local_pw
docker ps | findstr promptforge-db
pause
