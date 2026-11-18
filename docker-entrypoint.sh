#!/bin/sh
set -e
echo "[worldmap] Chạy migration database…"
npx prisma migrate deploy
if [ "$SEED_DEMO" = "true" ]; then
  echo "[worldmap] Nạp dữ liệu mẫu (SEED_DEMO=true)…"
  npx tsx prisma/seed.ts
fi
exec "$@"
