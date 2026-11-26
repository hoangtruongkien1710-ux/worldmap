# WorldMap EDU – ghi chú cho AI (đọc đầu mỗi phiên)

App quản lý trung tâm ngoại ngữ: **1 database, 2 giao diện** – Lớp học (`/`) và Kế toán (`/ke-toan`).
Next.js 15 (App Router, server actions) · Prisma 6 · PostgreSQL 16 (Docker) · Auth.js v5 · Tailwind 4 · vitest.
Trả lời người dùng bằng **tiếng Việt**, ngắn gọn. Kế hoạch: `../kehoach.md`. Nhật ký: `NHATKY.md`.

## Sửa ở đâu
- Dữ liệu: `prisma/schema.prisma` (+ `npx prisma migrate dev --name <ten>`). Dữ liệu mẫu: `prisma/seed*.ts` (chỉ import tương đối, không dùng `@/`).
- Trang: `src/app/(lop-hoc)/…`, `src/app/ke-toan/…`. Thao tác ghi: `src/lib/actions/*.ts` (bọc `run()`, kiểm quyền bằng `requirePermission`).
- Phân quyền 4 vai trò: `src/lib/auth/permissions.ts`. **Luôn kiểm quyền ở server**, không chỉ ẩn nút.
- Học phí theo tháng: `src/lib/tuition/month.ts` – **một chỗ tính duy nhất** cho màn hình, báo cáo, Excel.
- Báo cáo lớp học: `src/lib/tuition/report.ts`; kế toán: `src/lib/accounting/`. Ghi sổ kép qua `postEntry`.
- Popup dùng chung: `src/components/ui/modal.tsx`. Bộ lọc: `src/components/classes/filter-form.tsx`. Excel: `src/lib/xlsx.ts`.
- Tiền là số nguyên VND; ngày là chuỗi `yyyy-MM-dd` (`src/lib/dates.ts`, giờ Việt Nam).
- File lớn: tìm theo tên hàm rồi sửa, không đọc cả file.

## Cổng
| | Máy tính | VPS |
|---|---|---|
| App (Docker) | 3005 | – |
| App (`npm run dev`) | 3006 | – |
| App (pm2) | – | 3300 |
| Database (`DB_PORT`, chỉ 127.0.0.1) | 5441 | 5441 |
Không tắt tiến trình đang giữ cổng của app khác.

## Chạy / test
- Windows: PowerShell chặn `npm.ps1` → dùng `npm.cmd` (VD `npm.cmd run dev`).
- Docker cả app: `docker compose up -d --build`. Chỉ DB: `docker compose up -d db`.
- `npm.cmd run typecheck` · `npm.cmd test` · `npm.cmd run build`.
- Lỗi `ENOENT .next/...` sau khi cài thư viện: tắt app, xóa `.next`, chạy lại.
- **Không thử trên database thật**: dùng DB thử riêng + cổng khác. Kiểm giao diện ở 1366×768 và 390px.

## Quy trình
1. Sửa và kiểm tra ở máy tính.
2. AI **commit ở máy, không tự push**; ghi 1 dòng vào `NHATKY.md`.
3. Chủ dự án tự `git push origin main`.
4. VPS: `cd ~/worldmap && ./capnhat.sh` (sao lưu DB → pull → npm ci → migrate → build → pm2 restart → kiểm tra 200). Thử trước: `./capnhat.sh --dry-run`.
- **Không sửa code trực tiếp trên VPS**; khác biệt giữa máy đặt trong `.env`.

## Bảo mật
- `.env` không bao giờ lên GitHub; `.env.example` chỉ có tên biến. Không dán mật khẩu/khoá vào chat.
- Database chỉ mở `127.0.0.1:${DB_PORT}`. Tài khoản mẫu `Worldmap@2026` chỉ dùng để thử (`SEED_DEMO=true`).
- Hỏi lại trước khi làm việc không hoàn tác được: `docker compose down -v`, `prisma migrate reset`, xóa dữ liệu hàng loạt.
