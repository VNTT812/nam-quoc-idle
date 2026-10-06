@echo off
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Can cai Node.js 18+: https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules\ws (
  echo Dang npm install...
  call npm install
)
set MP_DEV_OPEN=1
echo.
echo MP server: ws://127.0.0.1:3847
echo Health:   http://127.0.0.1:3847/health
echo Game:     chay python http.server roi mo ?mp_auth=1
echo.
node src/index.js
pause
