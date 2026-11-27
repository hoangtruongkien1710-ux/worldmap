# Nhật ký tiến độ (mỗi việc xong ghi 1 dòng, mới nhất ở dưới)

- 2026-11-18: Khung app Next.js + Prisma + PostgreSQL + Docker, đăng nhập, phân quyền 4 vai trò, 2 giao diện.
- 2026-11-18: Khóa học theo bảng giá 2026, 12 lớp, dữ liệu mẫu; khu Kế toán (quỹ, ngân hàng, chi phí, lương, tổng hợp).
- 2026-11-19: Học viên, Học phí, Công nợ, Lịch học tuần; trang chi tiết lớp (4 tab, thu nhiều đợt); popup thêm/sửa/xóa mọi màn.
- 2026-11-19: Báo cáo kế toán 6 loại + kiểm quỹ; bộ lọc dropdown cho Lớp học và Học viên.
- 2026-11-19: Học phí / Công nợ / Báo cáo theo ảnh mẫu, SĐT riêng của học viên, xuất Excel (3ec169e). Đẩy lên GitHub.
- 2026-11-26: Áp dụng kinh nghiệm app mẫu: CLAUDE.md, NHATKY.md, capnhat.sh (pm2), DB_PORT/APP_PORT, .env.example không giá trị thật, .gitignore an toàn.
- 2026-11-26: Sửa giao diện: icon mắt mật khẩu, báo tài khoản bị khóa, báo trùng tên đăng nhập, giới hạn Họ tên 60 ký tự, tài liệu giáo trình (upload/link), cột Học phí ở Học viên (Chưa đóng/Còn nợ/Đã đóng đủ), ô số tiền thu tự định dạng và không vượt số cần đóng.
- 2026-11-26: Form popup giữ nguyên dữ liệu khi lỗi, chỉ tô đỏ + báo ở đúng ô sai; ô tiền (MoneyInput) cảnh báo số âm, tự thêm dấu chấm; máy chủ chặn số âm (int).
- 2026-11-27: Kế toán: sắp xếp theo cột (tăng/giảm/bỏ), thanh thời gian (hôm nay…năm, khoảng ngày), mới nhất trước, sửa chứng từ + hóa đơn mua hàng, trang chi tiết học phí, liên kết giữa sổ/học phí/lương/chi phí, bảng tổng hợp đẹp hơn.
- 2026-11-27: Kế toán: nút Xuất Excel ở Sổ quỹ, Ngân hàng, Học phí, Chi phí, Tổng hợp, Tiền lương (theo thời gian, bộ lọc, sắp xếp đang xem).
- 2026-11-27: Tiền lương theo mẫu kế toán: nhập Excel có xem trước, cột Định mức/Tăng ca/Ngày lễ/Ứng lương, Chốt → Trả lương (+Hủy), sửa/xóa dòng, xuất Excel đúng bố cục mẫu, file mẫu tải về.
