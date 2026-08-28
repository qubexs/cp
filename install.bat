@echo off
setlocal enabledelayedexpansion
echo ==========================================
echo  Cinematic Prompt Lab - Installer
echo  Same PC (not cloud) - Choose DB backend
echo ==========================================
if exist ".env" (
  echo [Found existing .env - checking install state]
  if exist ".install-state.json" type ".install-state.json"
  echo.
  echo Options:
  echo   1) Migrate DB (keep data, prisma migrate deploy)
  echo   2) Re-configure backend (switch docker/native/node)
  echo   3) Fresh reset (DROP DATA)
  echo   4) Start DB + dev server
  set /p choice="Choose 1-4 (default 1): "
  if "!choice!"=="" set choice=1
  if "!choice!"=="1" goto MIGRATE
  if "!choice!"=="2" goto CHOOSE
  if "!choice!"=="3" goto RESET
  if "!choice!"=="4" goto START
  goto MIGRATE
)
:CHOOSE
echo.
echo Choose backend:
echo   1) Docker Postgres (needs Docker Desktop)  [Recommended]
echo   2) Native Postgres (needs postgresql.org)
echo   3) Node.js-only PGlite/SQLite (no server, file dev.db)
set /p backend="Choose 1-3 (default 1): "
if "!backend!"=="" set backend=1
if "!backend!"=="1" (
  echo DB_PROVIDER=postgresql> .env.tmp
  echo DATABASE_URL=postgresql://promptforge:promptforge_local_pw@localhost:5432/promptforge?schema=public>> .env.tmp
  echo backend=docker
  copy /y .env.tmp .env >nul
  copy /y .env Cinematic\.env >nul 2>&1
  echo {"backend":"docker","dbProvider":"postgresql","databaseUrl":"postgresql://promptforge:promptforge_local_pw@localhost:5432/promptforge?schema=public","installedAt":"%date% %time%"} > .install-state.json
  goto SETUP
)
if "!backend!"=="2" (
  echo DB_PROVIDER=postgresql> .env.tmp
  echo DATABASE_URL=postgresql://promptforge:promptforge_local_pw@localhost:5432/promptforge?schema=public>> .env.tmp
  copy /y .env.tmp .env >nul
  copy /y .env Cinematic\.env >nul 2>&1
  echo {"backend":"native","dbProvider":"postgresql","databaseUrl":"postgresql://promptforge:promptforge_local_pw@localhost:5432/promptforge?schema=public","installedAt":"%date% %time%"} > .install-state.json
  goto SETUP
)
if "!backend!"=="3" (
  echo DB_PROVIDER=sqlite> .env.tmp
  echo DATABASE_URL=file:./dev.db>> .env.tmp
  copy /y .env.tmp .env >nul
  copy /y .env Cinematic\.env >nul 2>&1
  echo {"backend":"node","dbProvider":"sqlite","databaseUrl":"file:./dev.db","installedAt":"%date% %time%"} > .install-state.json
  goto SETUP
)
:SETUP
echo.
echo Installing npm deps...
call npm install
echo Generating Prisma client...
call npx prisma generate
echo Running migrations...
call npx prisma migrate dev --name init
echo Starting dev server...
call npm run dev
goto END
:MIGRATE
echo Migrating...
call npx prisma migrate deploy
call npx prisma generate
echo Done migrate.
goto END
:RESET
echo WARNING: This will DROP data!
set /p confirm="Type YES to confirm: "
if not "!confirm!"=="YES" goto END
call npx prisma migrate reset --force
goto END
:START
echo Starting DB if docker...
docker compose up -d 2>nul
call npm run dev
:END
pause
