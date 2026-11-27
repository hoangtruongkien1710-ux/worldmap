# Kinh nghiệm làm app nội bộ & triển khai VPS (rút ra từ app Quản lý dự án và công việc, 11/2026)

Dùng file này làm "bài học sẵn" khi làm app mới. Chép file vào thư mục app mới, rồi bảo AI đọc trước khi bắt đầu.

---

## 1. Bắt đầu một app mới

- **Viết kế hoạch trước (KH.md), duyệt xong mới làm.** Ghi mục tiêu, các phần, phân quyền, quyết định đã chốt. Có mục "Nhật ký tiến độ": mỗi bước xong ghi 1 dòng.
- **Viết CLAUDE.md ngắn (≤ 60 dòng):** kiến trúc, sửa ở đâu, cách chạy / test, quy trình đưa lên VPS, quy tắc bảo mật. AI đọc file này đầu mỗi phiên nên đỡ phải giải thích lại, tiết kiệm token.
- **Mỗi app = 1 thư mục + 1 repo GitHub riêng.** Mở phiên AI ngay trong thư mục app đó, đừng mở ở thư mục khác.
- **Chọn cổng riêng ngay từ đầu** và ghi vào CLAUDE.md. Máy local: 3000 hay bị chiếm, nên dùng 3100, 3101 (thử)… VPS có nhiều app: mỗi app một cổng (app này 3200), database cũng một cổng riêng (app này 5440).
- **Công nghệ đã dùng ổn:** Next.js 15 + PostgreSQL 16 (Docker) + Prisma 6. Chạy được cả local lẫn VPS.

## 2. Bảo mật (luôn làm)

- `.env` **không bao giờ** lên GitHub. Có `.env.example` chỉ chứa tên biến, không chứa giá trị thật.
- `.gitignore` sẵn: `node_modules`, `.next`, `.env`, `*.log`, file khoá Google (`*service-account*.json`, `google-key.json`).
- Không dán mã bot, mật khẩu, khoá vào chat với AI. Chỉ điền thẳng vào `.env`.
- Mã đăng nhập chỉ lưu dạng mã hoá (HMAC), không lưu chữ gốc.
- Dữ liệu từ Google Sheet khác (nhân sự…): làm 1 Web App Apps Script **chỉ trả đúng các cột cần dùng**, có khoá bí mật `?key=`, mã hoá mật khẩu ngay trong Apps Script. Không đọc cột lương / số điện thoại.
- Database chỉ mở trong máy: `127.0.0.1:<cổng>:5432` trong docker-compose, không mở ra internet.
- Trước khi push lần đầu: kiểm tra lịch sử git không có `.env` hay khoá.

## 3. Quy trình làm việc hằng ngày

1. Sửa ở **máy tính (local)** → chạy `npm.cmd run dev` → kiểm tra ở `http://localhost:<cổng>`.
2. Ổn thì commit (AI tự commit ở máy, **không tự push**).
3. Chủ dự án tự `git push origin main`.
4. Trên VPS: `cd ~/<app> && ./capnhat.sh`. Xong, mở app và bấm Ctrl+F5.

**Windows:** PowerShell chặn `npm.ps1`, nên dùng `npm.cmd` (ví dụ `npm.cmd run dev`).

## 4. Triển khai VPS nhanh (làm 1 lần cho mỗi app)

1. Trên VPS: `git clone <repo> ~/<app>`, tạo `.env` riêng cho VPS (cổng DB riêng qua biến `DB_PORT`).
2. `docker compose --env-file .env up -d` (database), `npm install`, `npx prisma migrate deploy`, `npm run build`.
3. Lần đầu chạy `./capnhat.sh`: script tự đăng ký app với **pm2**.
4. Cho pm2 tự chạy khi VPS khởi động lại: `pm2 startup` → chép dòng `sudo …` nó in ra và chạy → `pm2 save`.
5. Kiểm tra: `pm2 list` thấy app "online".

**Script `capnhat.sh` (chép từ app này, sửa tên app / cổng / container) tự làm 7 bước:**
1. Sao lưu DB vào `~/backups` (giữ 14 bản).
2. `git pull --ff-only`.
3. `npm install` khi đổi thư viện.
4. `prisma migrate deploy` khi có migration mới.
5. Build (lỗi thì dừng, app cũ vẫn chạy).
6. `pm2 restart`.
7. Kiểm tra app trả lời 200.

Có `--dry-run` để xem trước. **Script không chạy `docker compose`**, nên database không bị tạo lại.

## 5. Những lỗi đã gặp & cách tránh

| Lỗi | Nguyên nhân | Cách tránh / sửa |
|---|---|---|
| `EADDRINUSE …:3100` | App cũ vẫn chạy ở cổng đó | Tắt terminal cũ (Ctrl+C). Kiểm tra cổng trước khi chạy; không tắt bừa app người khác |
| `node:child_process is not handled` (Build Error) | `instrumentation.ts` import code Node bằng `return` sớm | Đặt import **bên trong** `if (process.env.NEXT_RUNTIME === 'nodejs') { … }` |
| `ENOENT … .next/server/app/route.js` | Nâng cấp Next.js / cài thư viện khi app đang chạy | Ctrl+C → `Remove-Item -Recurse -Force .next` → chạy lại |
| `./capnhat.sh` dừng: "file bị sửa tay" | Sửa trực tiếp file trên VPS (đổi cổng, nâng Next.js) | **Không sửa code trên VPS.** Đưa thay đổi vào code chung (biến môi trường như `DB_PORT`), rồi `git checkout -- <file>` |
| Bật app mới báo cổng bận ngay sau `kill` | Tiến trình cũ chưa kịp thoát | Đợi vài giây, kiểm tra `ss -ltnp \| grep <cổng>`. Dùng pm2 thì không gặp |
| App tắt sau khi VPS khởi động lại | Chạy kiểu "bật tay" (nohup) | Dùng pm2 + `pm2 startup` + `pm2 save` |
| Sao lưu ra file 0 byte | Gõ nhầm tên container (để nguyên chữ mẫu) | Xem tên thật bằng `docker ps`. Script dừng nếu file sao lưu rỗng |
| Lệnh dài bị xuống dòng giữa chừng | Dán lệnh nhiều dòng vào terminal | Mỗi lệnh 1 dòng, gõ xong Enter rồi mới dán lệnh tiếp |
| Gõ `pm2` trên Windows báo không có | Đang ở máy tính chứ không phải VPS (dấu nhắc `PS C:\…`) | Chú ý dấu nhắc: `kiensmee@…:~$` mới là VPS |
| Đăng nhập chậm (bản Apps Script) | Đọc cả bảng Google Sheet mỗi lần | Chuyển sang database thật (PostgreSQL): đăng nhập ~50 ms |

## 6. Kiểm thử an toàn

- **Không thử trên database thật.** Tạo database thử (`smee_test`) trong cùng container, chạy app thử ở cổng khác (3101) với thư mục build riêng (`NEXT_DIST_DIR=.next-test`). Xong thì xoá database thử.
- Có bộ test e2e gọi API thật. Sửa nhỏ thì chỉ chạy phần liên quan.
- Kiểm tra giao diện ở 2 cỡ: laptop 1366×768 và điện thoại 390px.

## 7. Giao diện: những điều người dùng thích

- Bộ lọc gọn: 1 hàng nhanh luôn hiện (Bộ lọc (n), tìm kiếm, chuyển kiểu xem), phần còn lại bấm mới mở. Màn nhỏ mặc định đóng, nhớ trạng thái.
- Lọc ngay ở **tiêu đề cột** (kiểu Excel). Mỗi cột có nút "Bỏ lọc cột này", và có thêm nút "Xóa lọc" tổng.
- Nút thao tác mỗi dòng gom vào **1 nút bút** mở menu có chữ. Đừng xếp nhiều icon dọc.
- Hàng nút đầu màn: chỉ hiện nút chính, nút phụ vào "⋯ Thao tác".
- Nhóm danh sách theo **Dự án → Hạng mục**. Lọc 1 dự án thì hiện tên dự án to cạnh tiêu đề.
- Nhiều link: hiện link đầu + "Xem thêm (N)". Xuất Excel có sheet "Danh sách link" (mỗi link 1 dòng, bấm được) và bật sẵn bộ lọc.
- Lọc nhân viên luôn theo thứ tự **Phòng ban → Nhân viên**.

## 8. Làm việc với AI cho tiết kiệm

- Mở phiên ngay trong thư mục app; có CLAUDE.md + KH.md là AI tự nắm bối cảnh.
- Yêu cầu rõ từng việc, gửi ảnh chụp chỗ cần sửa.
- File lớn: bảo AI "tìm theo tên hàm rồi sửa", không đọc cả file.
- Mỗi việc xong: commit + 1 dòng nhật ký. Hôm sau mở phiên mới vẫn nối tiếp được.

## 9. Cài VPS từ đầu (A–Z, cho app mới)

```
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm install -g pm2
sudo usermod -aG docker $USER        # đăng xuất / vào lại để có quyền docker
git clone <repo> ~/<app> && cd ~/<app>
cp .env.example .env && nano .env    # điền mật khẩu DB, DB_PORT, khoá bí mật…
docker compose --env-file .env up -d
npm install && npx prisma migrate deploy && npm run build
./capnhat.sh                         # lần đầu: đăng ký pm2
pm2 startup                          # chép dòng sudo … nó in ra và chạy
pm2 save
```

- Mở cổng app trên tường lửa (nếu có): `sudo ufw allow <cổng>/tcp`. **Không mở cổng database.**
- Nên có **tên miền + HTTPS**: dùng Caddy (tự lấy chứng chỉ). Ví dụ file Caddyfile:
  `app.tenmien.vn { reverse_proxy 127.0.0.1:<cổng> }`
- **Sao lưu tự động hằng ngày** (`crontab -e`), giữ 14 ngày:
  `0 2 * * * docker exec <container_db> pg_dump -U <user> <db> > ~/backups/daily_$(date +\%F).sql && find ~/backups -name 'daily_*.sql' -mtime +14 -delete`
- Kiểm tra app sống: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:<cổng>/` phải ra 200.

## 10. An toàn khi làm việc

- **Che token / mật khẩu / mã đăng nhập trước khi chụp màn hình gửi AI.** Nếu lỡ lộ: thu hồi và tạo mã mới ngay (ví dụ đổi token bot Telegram ở BotFather).
- Phân quyền luôn **kiểm tra ở máy chủ**, không chỉ ẩn nút trên giao diện.
- Luôn sao lưu DB trước khi cập nhật (capnhat.sh tự làm).
- Thao tác không hoàn tác được (xoá DB, "Làm trắng dữ liệu", `docker compose down -v`, `prisma migrate reset`): hỏi lại trước khi làm.

## 11. Nên làm sớm cho app sau

- Ngay từ đầu: `capnhat.sh`, pm2, `DB_PORT` trong `.env`, cron sao lưu hằng ngày.
- Tên miền + HTTPS trước khi gửi link cho người ngoài.
- Một quy tắc tính số liệu dùng chung mọi nơi (màn hình, báo cáo, Excel). Ví dụ: "Công việc khác" = 1 sản phẩm / kết quả. Tránh mỗi chỗ tính một kiểu.
- (Tuỳ chọn) Dockerfile cho app, nếu muốn chạy app cũng bằng Docker.

## 12. Mẫu prompt khởi đầu cho app mới

```
Tôi muốn làm app <tên app> cho công ty: <mô tả ngắn, ai dùng, chức năng chính>.
Công nghệ: Next.js 15 + PostgreSQL 16 (Docker) + Prisma, chạy local trước rồi lên VPS bằng pm2.
Đọc kinhnghiemapp.md trước. Hãy:
1) Viết KH.md (kế hoạch, phân quyền, giai đoạn) và CLAUDE.md ngắn, chờ tôi duyệt rồi mới code.
2) Dùng cổng app <cổng>, DB_PORT <cổng DB>, có .env.example, capnhat.sh, .gitignore an toàn.
3) Mỗi bước xong: commit ở máy, ghi 1 dòng Nhật ký trong KH.md, không push.
Trả lời bằng tiếng Việt, ngắn gọn.
```
