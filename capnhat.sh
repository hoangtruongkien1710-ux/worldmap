#!/usr/bin/env bash
# Cập nhật WorldMap trên VPS (app chạy bằng pm2, database chạy bằng Docker).
#   ./capnhat.sh            cập nhật thật
#   ./capnhat.sh --dry-run  chỉ in ra các bước sẽ làm
# Script KHÔNG chạy `docker compose up/down`, nên database không bị tạo lại.
set -euo pipefail

APP_NAME="worldmap"
BACKUP_DIR="$HOME/backups/$APP_NAME"
KEEP=14
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

cd "$(dirname "$0")"
[ -f .env ] || { echo "Thiếu file .env (chép từ .env.example rồi điền)."; exit 1; }
APP_PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2 | tr -d '"' || true)
APP_PORT=${APP_PORT:-3300}

step() { echo; echo "==> $*"; }
run() { if [ $DRY = 1 ]; then echo "   [thử] $*"; else eval "$@"; fi; }

# 0. Không cho chạy khi code trên VPS bị sửa tay
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Dừng: có file bị sửa tay trên VPS:"; git status --short --untracked-files=no
  echo "Đưa thay đổi vào code chung rồi chạy: git checkout -- <file>"; exit 1
fi

step "1/7 Sao lưu database vào $BACKUP_DIR (giữ $KEEP bản)"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/truoc_capnhat_$(date +%F_%H%M).sql.gz"
if [ $DRY = 0 ]; then
  docker compose exec -T db pg_dump -U worldmap worldmap | gzip > "$FILE"
  # File gzip rỗng vẫn ~20 byte: dưới 1 KB coi như sao lưu hỏng
  [ "$(stat -c%s "$FILE")" -gt 1024 ] || { echo "Dừng: file sao lưu rỗng ($FILE). Kiểm tra database bằng: docker compose ps"; rm -f "$FILE"; exit 1; }
  ls -1t "$BACKUP_DIR"/truoc_capnhat_*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
  echo "   Đã lưu $FILE"
else echo "   [thử] pg_dump → $FILE"; fi

step "2/7 Lấy code mới (git pull --ff-only)"
OLD=$(git rev-parse HEAD)
run git pull --ff-only
NEW=$(git rev-parse HEAD)
CHANGED=$(git diff --name-only "$OLD" "$NEW" || true)
[ "$OLD" = "$NEW" ] && echo "   Không có code mới (vẫn build lại cho chắc)."

step "3/7 Cài thư viện (khi package-lock.json đổi, hoặc chưa có node_modules)"
if [ ! -d node_modules ] || echo "$CHANGED" | grep -q '^package-lock.json$'; then run npm ci; else echo "   Bỏ qua."; fi
run npx prisma generate

step "4/7 Cập nhật cấu trúc database (khi có migration mới)"
if [ $DRY = 1 ] || echo "$CHANGED" | grep -q '^prisma/migrations/' || [ "$OLD" = "$NEW" ]; then run npx prisma migrate deploy; else echo "   Bỏ qua."; fi

step "5/7 Build ra thư mục tạm .next-build (lỗi thì dừng, app cũ vẫn chạy)"
run rm -rf .next-build
run NEXT_DIST_DIR=.next-build npm run build
run "rm -rf .next-old && { [ -d .next ] && mv .next .next-old || true; } && mv .next-build .next"

step "6/7 Khởi động lại bằng pm2 (cổng $APP_PORT)"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then run pm2 restart "$APP_NAME" --update-env
else run "pm2 start npm --name $APP_NAME -- start -- -p $APP_PORT && pm2 save"; fi

step "7/7 Kiểm tra app trả lời"
[ $DRY = 1 ] && { echo "   [thử] curl http://127.0.0.1:$APP_PORT/dang-nhap"; echo; echo "Xong (chạy thử, chưa đổi gì)."; exit 0; }
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/dang-nhap" || true)
  [ "$CODE" = "200" ] && { rm -rf .next-old; echo "   OK (200). Mở app và bấm Ctrl+F5."; exit 0; }
  sleep 2
done
echo "   Lỗi: app trả về '$CODE'. Xem log: pm2 logs $APP_NAME --lines 50"
echo "   Quay lại bản build cũ: rm -rf .next && mv .next-old .next && pm2 restart $APP_NAME"
exit 1
