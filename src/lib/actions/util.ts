import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ActionResult } from "@/components/ui/modal";

/** Lỗi nghiệp vụ: hiện nguyên văn cho người dùng. `field` = tên ô bị sai để form đánh dấu đúng ô đó. */
export class UserError extends Error {
  constructor(message: string, public field?: string) { super(message); }
}

/** Bọc server action: bắt lỗi thành thông báo tiếng Việt, tải lại các trang liên quan. */
export async function run(fn: () => Promise<string | void>, paths: string[] = ["/"]): Promise<ActionResult> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p, "layout");
    return { ok: true, message: message || undefined, at: Date.now() };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message, field: e.field, at: Date.now() };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const f = String((e.meta?.target as string[] | string | undefined) ?? "");
      const what = f.includes("username") ? "Tên đăng nhập" : f.includes("name") ? "Tên" : "Mã";
      const field = f.includes("username") ? "username" : f.includes("name") ? "name" : "code";
      return { ok: false, error: `${what} này đã tồn tại, hãy chọn ${what.toLowerCase()} khác.`, field, at: Date.now() };
    }
    if (e instanceof Error && e.message.includes("không có quyền")) return { ok: false, error: e.message, at: Date.now() };
    console.error(e);
    return { ok: false, error: "Có lỗi khi lưu, hãy thử lại.", at: Date.now() };
  }
}

/* ---- Đọc form ---- */
export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const opt = (f: FormData, k: string) => str(f, k) || null;
export function req(f: FormData, k: string, label: string) {
  const v = str(f, k);
  if (!v) throw new UserError(`Vui lòng nhập ${label}.`, k);
  return v;
}
const NUM_LABEL: Record<string, string> = {
  unitPrice: "Học phí", listedPrice: "Học phí niêm yết", amount: "Số tiền", counted: "Số tiền đếm được", maxStudents: "Sĩ số tối đa",
  totalSessions: "Số buổi", percentDiscount: "Giảm giá (%)", sessionsMin: "Số buổi", sessionsMax: "Số buổi", classSizeMin: "Sĩ số", classSizeMax: "Sĩ số", order: "Thứ tự",
};
/** Đọc số nguyên (bỏ dấu chấm ngăn cách). Mặc định không nhận số âm. */
export function int(f: FormData, k: string, label?: string, allowNegative = false): number | null {
  const name = label ?? NUM_LABEL[k] ?? "Giá trị";
  const raw = str(f, k).replace(/[.\s,đ]/g, "");
  if (!raw) {
    if (label) throw new UserError(`Vui lòng nhập ${label}.`, k);
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new UserError(`${name} phải là số nguyên.`, k);
  if (n < 0 && !allowNegative) throw new UserError(`${name} không được âm.`, k);
  return n;
}
export function day(f: FormData, k: string, label: string) {
  const v = str(f, k);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new UserError(`Vui lòng chọn ${label}.`, k);
  return v;
}
export function time(f: FormData, k: string, label: string) {
  const v = str(f, k);
  if (!/^\d{2}:\d{2}$/.test(v)) throw new UserError(`Giờ ${label} không hợp lệ.`, k);
  return v;
}

export async function audit(actorId: string, action: string, entity: string, entityId?: string, detail?: unknown) {
  await db.auditLog.create({ data: { actorId, action, entity, entityId, detail: detail as never } });
}
