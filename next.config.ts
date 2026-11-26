import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker build đặt NEXT_STANDALONE=1; VPS chạy bằng pm2 dùng `next start` bình thường
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  // capnhat.sh build ra thư mục tạm rồi mới đổi tên, để app cũ vẫn chạy nếu build lỗi
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Cho phép tải tài liệu / giáo trình đến 20 MB qua server action
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
};

export default nextConfig;
