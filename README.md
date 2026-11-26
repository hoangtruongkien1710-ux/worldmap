# WorldMap EDU – Quản lý lớp học & Kế toán

App quản lý trung tâm WorldMap: **một database, hai giao diện**.
- **Lớp học** (`/`): lớp, lịch, học sinh, điểm danh, học phí, công nợ.
- **Kế toán** (`/ke-toan`): kế toán nội bộ kiểu MISA, bản gọn.

Công nghệ: Next.js 15, TypeScript, Prisma 6, PostgreSQL 16, Auth.js, Tailwind CSS 4, Docker.
Kế hoạch chi tiết: `../kehoach.md`.

## Chạy nhanh bằng Docker (khuyên dùng)

Cần cài **Docker Desktop** (Windows/macOS) hoặc Docker Engine (Linux).

```bash
cp .env.example .env
# Mở .env, điền DB_PASSWORD, DATABASE_URL, AUTH_SECRET (chuỗi ngẫu nhiên dài), AUTH_URL
# (lần đầu muốn có dữ liệu mẫu thì đặt SEED_DEMO=true)
docker compose up -d --build
```

Mở http://localhost:3005 (cổng đổi bằng `APP_PORT` trong `.env`).

**Tài khoản mẫu** (chỉ có khi `SEED_DEMO=true`). Mật khẩu chung: `Worldmap@2026`

| Tài khoản | Vai trò |
|---|---|
| `admin` | Quản trị viên (vào được cả Lớp học và Kế toán) |
| `quanly` | Quản lý |
| `ketoan` | Kế toán |
| `gv.trung` (HSK), `gv.ngoc`, `gv.nam` (IELTS), `gv.huy` (TOEIC) | Giáo viên (chỉ thấy lớp mình dạy) |

Dữ liệu mẫu gồm 13 khóa học theo bảng giá niêm yết 2026 (HSK, IELTS, TOEIC), 12 lớp, khoảng 100 học viên, điểm danh, và phần kế toán từ 01/09/2026: quỹ tiền mặt, 2 tài khoản ngân hàng, thu học phí, chi phí, công nợ nhà cung cấp, bảng lương tháng 9 và 10, toàn bộ bút toán kép.

Sau lần chạy đầu, đặt lại `SEED_DEMO=false` (hoặc xóa dòng đó) và **đổi mật khẩu các tài khoản** trước khi dùng thật.

Các lệnh hay dùng:
```bash
docker compose logs -f app        # xem log
docker compose down               # tắt (dữ liệu vẫn giữ)
docker compose up -d --build      # cập nhật sau khi sửa code
```
Database được sao lưu hằng ngày vào thư mục `./backups` (giữ 30 ngày).
Khi có tên miền: sửa `Caddyfile`, đặt `AUTH_URL=https://ten-mien`, rồi chạy `docker compose --profile https up -d`.

## Chạy để lập trình

Trên Windows dùng `npm.cmd` thay cho `npm`.
```bash
npm install
docker compose up -d db              # chỉ chạy PostgreSQL (cổng DB_PORT, chỉ mở trong máy)
npx prisma migrate dev               # tạo bảng
npm run db:seed                      # dữ liệu mẫu
npm run dev                          # http://localhost:3006
npm test                             # chạy test
```

## Đưa lên VPS (app chạy bằng pm2)

Làm 1 lần:
```bash
git clone https://github.com/hoangtruongkien1710-ux/worldmap.git ~/worldmap && cd ~/worldmap
cp .env.example .env && nano .env    # APP_PORT=3300, DB_PORT=5441, mật khẩu DB, AUTH_SECRET, AUTH_URL
# DATABASE_URL=postgresql://worldmap:<DB_PASSWORD>@127.0.0.1:5441/worldmap?schema=public
docker compose up -d db backup       # database + sao lưu hằng ngày (không chạy app container)
npm ci && npx prisma migrate deploy
./capnhat.sh                         # lần đầu: build và đăng ký app với pm2
pm2 startup                          # chép dòng sudo … nó in ra và chạy
pm2 save
```

Mỗi lần có bản mới (sau khi `git push` từ máy tính): `cd ~/worldmap && ./capnhat.sh`.
Script tự sao lưu DB (giữ 14 bản), `git pull`, cài thư viện, migrate, build ra thư mục tạm (lỗi thì app cũ vẫn chạy), `pm2 restart`, kiểm tra 200. Thử trước: `./capnhat.sh --dry-run`.
Không sửa code trực tiếp trên VPS. Không mở cổng database trên tường lửa.
Có tên miền: dùng Caddy, `quanly.tenmien.vn { reverse_proxy 127.0.0.1:3300 }`.

## Cấu trúc thư mục

```
prisma/schema.prisma         Mô hình dữ liệu
prisma/seed.ts               Dữ liệu mẫu
src/app/(lop-hoc)/           Giao diện Lớp học
src/app/ke-toan/             Giao diện Kế toán
src/app/dang-nhap/           Đăng nhập
src/lib/auth/permissions.ts  Ma trận phân quyền 4 vai trò
src/lib/schedule/            Sinh buổi học từ lịch cố định
src/lib/dates.ts             Xử lý ngày theo giờ Việt Nam
```

## Tiến độ

Xem `NHATKY.md`. Ghi chú cho AI: `CLAUDE.md`.
