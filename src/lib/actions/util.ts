import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ActionResult } from "@/components/ui/modal";

/** Lỗi nghiệp vụ: hiện nguyên văn cho người dùng. */
export class UserError extends Error {}

/** Bọc server action: bắt lỗi thành thông báo tiếng Việt, tải lại các trang liên quan. */
export async function run(fn: () => Promise<string | void>, paths: string[] = ["/"]): Promise<ActionResult> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p, "layout");
    return { ok: true, message: message || undefined, at: Date.now() };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message, at: Date.now() };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "Mã này đã tồn tại, hãy chọn mã khác.", at: Date.now() };
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
  if (!v) throw new UserError(`Vui lòng nhập ${label}.`);
  return v;
}
export function int(f: FormData, k: string, label?: string): number | null {
  const raw = str(f, k).replace(/[.\s,đ]/g, "");
  if (!raw) {
    if (label) throw new UserError(`Vui lòng nhập ${label}.`);
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new UserError(`${label ?? k} phải là số nguyên.`);
  return n;
}
export function day(f: FormData, k: string, label: string) {
  const v = str(f, k);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new UserError(`Vui lòng chọn ${label}.`);
  return v;
}
export function time(f: FormData, k: string, label: string) {
  const v = str(f, k);
  if (!/^\d{2}:\d{2}$/.test(v)) throw new UserError(`Giờ ${label} không hợp lệ.`);
  return v;
}

export async function audit(actorId: string, action: string, entity: string, entityId?: string, detail?: unknown) {
  await db.auditLog.create({ data: { actorId, action, entity, entityId, detail: detail as never } });
}
