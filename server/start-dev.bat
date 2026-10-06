@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Can Node.js 18+ & pause & exit /b 1)
if not exist node_modules\ws call npm install
if "%MP_DEV_OPEN%"=="" set MP_DEV_OPEN=1
if "%SUPABASE_URL%"=="" set SUPABASE_URL=https://khwkokiflhzwxuzoilux.supabase.co
if "%SUPABASE_ANON_KEY%"=="" set SUPABASE_ANON_KEY=sb_publishable_4s1aei2J-OEdupk1EzbVvg_nqRtUG2u
echo MP server: ws://127.0.0.1:3847
node src/index.js
pause
