#!/usr/bin/env bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Cần Node.js 18+"; exit 1; }
[ -d node_modules/ws ] || npm install
export MP_DEV_OPEN="${MP_DEV_OPEN:-1}"
export SUPABASE_URL="${SUPABASE_URL:-https://khwkokiflhzwxuzoilux.supabase.co}"
export SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-sb_publishable_4s1aei2J-OEdupk1EzbVvg_nqRtUG2u}"
echo "MP server: ws://127.0.0.1:3847"
echo "Game: Pages hoặc local với mpAuth"
exec node src/index.js
