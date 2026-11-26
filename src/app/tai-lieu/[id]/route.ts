import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { UPLOAD_DIR } from "@/lib/uploads";

/** Mở / tải tài liệu khóa học (chỉ người đã đăng nhập và được xem lớp). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!can(session?.user?.role, "class.view")) return new Response("Không có quyền", { status: 403 });
  const { id } = await params;
  const m = await db.courseMaterial.findUnique({ where: { id } });
  if (!m) return new Response("Không tìm thấy tài liệu", { status: 404 });
  if (m.url) return Response.redirect(m.url, 302);
  if (!m.filePath) return new Response("Không tìm thấy file", { status: 404 });
  const full = path.join(UPLOAD_DIR, m.filePath);
  if (!full.startsWith(UPLOAD_DIR)) return new Response("Đường dẫn không hợp lệ", { status: 400 });
  const data = await readFile(full).catch(() => null);
  if (!data) return new Response("File đã bị xóa khỏi máy chủ", { status: 404 });
  const inline = /^(application\/pdf|image\/|text\/|audio\/)/.test(m.mimeType ?? "");
  const name = encodeURIComponent(m.fileName ?? m.title);
  return new Response(data, {
    headers: {
      "Content-Type": m.mimeType ?? "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
