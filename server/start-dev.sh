#!/usr/bin/env bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Cần Node.js 18+"; exit 1; }
[ -d node_modules/ws ] || npm install
export MP_DEV_OPEN=1
echo "MP server: ws://127.0.0.1:3847"
echo "Game local: python3 -m http.server 47291  →  http://127.0.0.1:47291/?mp_auth=1"
exec node src/index.js
