"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { MATERIAL_EXT, MATERIAL_MAX_MB, UPLOAD_DIR } from "@/lib/uploads";
import type { ActionResult } from "@/components/ui/modal";
import { audit, run, str, UserError } from "./util";

const PATHS = ["/lop-hoc"];

/** Thêm tài liệu cho khóa học: tải file lên hoặc gắn link (một trong hai). */
export async function addMaterial(courseId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const me = await requirePermission("class.manage");
    const file = f.get("file");
    const url = str(f, "url");
    const hasFile = file instanceof File && file.size > 0;
    if (!hasFile && !url) throw new UserError("Chọn file để tải lên hoặc dán link tài liệu.");
    if (hasFile && url) throw new UserError("Chỉ chọn một: tải file lên hoặc gắn link.");
    let title = str(f, "title");
    if (title.length > 120) throw new UserError("Tên tài liệu tối đa 120 ký tự.", "title");

    if (url) {
      if (!/^https?:\/\/\S+$/i.test(url)) throw new UserError("Link phải bắt đầu bằng http:// hoặc https://", "url");
      const m = await db.courseMaterial.create({ data: { courseId, title: title || url, url } });
      await audit(me.id, "create", "CourseMaterial", m.id, { url });
      return "Đã gắn link tài liệu.";
    }

    const ext = path.extname((file as File).name).slice(1).toLowerCase();
    if (!MATERIAL_EXT[ext]) throw new UserError(`Chỉ nhận file: ${Object.keys(MATERIAL_EXT).join(", ")}.`, "file");
    if ((file as File).size > MATERIAL_MAX_MB * 1024 * 1024) throw new UserError(`File tối đa ${MATERIAL_MAX_MB} MB.`, "file");
    title ||= path.basename((file as File).name, path.extname((file as File).name));
    const m = await db.courseMaterial.create({ data: { courseId, title, fileName: (file as File).name, mimeType: MATERIAL_EXT[ext], size: (file as File).size } });
    const rel = path.join("materials", `${m.id}.${ext}`);
    await mkdir(path.join(UPLOAD_DIR, "materials"), { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, rel), Buffer.from(await (file as File).arrayBuffer()));
    await db.courseMaterial.update({ where: { id: m.id }, data: { filePath: rel } });
    await audit(me.id, "create", "CourseMaterial", m.id, { file: (file as File).name });
    return `Đã tải lên “${title}”.`;
  }, PATHS);
}

export async function deleteMaterial(id: string, _: ActionResult) {
  return run(async () => {
    const me = await requirePermission("class.manage");
    const m = await db.courseMaterial.delete({ where: { id } });
    if (m.filePath) await unlink(path.join(UPLOAD_DIR, m.filePath)).catch(() => {});
    await audit(me.id, "delete", "CourseMaterial", id, { title: m.title });
    return "Đã xóa tài liệu.";
  }, PATHS);
}
