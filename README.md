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
# Mở .env, đổi AUTH_SECRET thành một chuỗi ngẫu nhiên dài
# (lần đầu muốn có dữ liệu mẫu thì thêm dòng SEED_DEMO=true)
docker compose up -d --build
```

Mở http://localhost:3000.

**Tài khoản mẫu** (chỉ có khi `SEED_DEMO=true`). Mật khẩu chung: `Worldmap@2026`

| Tài khoản | Vai trò |
|---|---|
| `admin` | Quản trị viên (vào được cả Lớp học và Kế toán) |
| `quanly` | Quản lý |
| `ketoan` | Kế toán |
| `gv.toan`, `gv.van`, `gv.anh` | Giáo viên (chỉ thấy lớp mình dạy) |

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

```bash
npm install
docker compose -f docker-compose.dev.yml up -d   # chỉ chạy PostgreSQL
cp .env.example .env
npx prisma migrate dev                            # tạo bảng
npm run db:seed                                   # dữ liệu mẫu
npm run dev                                       # http://localhost:3000
npm test                                          # chạy test
```

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

- [x] **Giai đoạn 0:** khung app, đăng nhập, phân quyền, hai giao diện, Docker, dữ liệu mẫu
- [ ] Giai đoạn 1: danh mục, lớp học, lịch học, người dùng, cài đặt
- [ ] Giai đoạn 2: học sinh và ghi danh
- [ ] Giai đoạn 3: điểm danh và nhận xét
- [ ] Giai đoạn 4: học phí và công nợ
- [ ] Giai đoạn 5: trang chủ đầy đủ, báo cáo
- [ ] Giai đoạn 5b: kế toán
- [ ] Giai đoạn 6: chuyển dữ liệu và triển khai
