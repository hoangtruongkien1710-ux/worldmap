"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import type { ActionResult } from "@/components/ui/modal";
import { audit, int, opt, req, run, str, UserError } from "./util";

const PATHS = ["/lop-hoc"];

function readCourse(f: FormData) {
  const listedPrice = int(f, "listedPrice", "học phí");
  if (!listedPrice || listedPrice <= 0) throw new UserError("Nhập học phí niêm yết.", "listedPrice");
  const hours = str(f, "sessionHours").replace(",", ".");
  return {
    programId: req(f, "programId", "chương trình"),
    name: req(f, "name", "tên khóa"),
    level: opt(f, "level"),
    target: opt(f, "target"),
    description: opt(f, "description"),
    sessionsMin: int(f, "sessionsMin"),
    sessionsMax: int(f, "sessionsMax"),
    sessionsPerWeek: opt(f, "sessionsPerWeek"),
    durationText: opt(f, "durationText"),
    sessionHours: hours ? Number(hours) : null,
    listedPrice,
    priceUnit: str(f, "priceUnit") === "SESSION" ? ("SESSION" as const) : ("COURSE" as const),
    classSizeMin: int(f, "classSizeMin"),
    classSizeMax: int(f, "classSizeMax"),
    coursebook: opt(f, "coursebook"),
  };
}

export async function createCourse(_: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    const data = readCourse(f);
    const last = await db.course.findFirst({ where: { programId: data.programId }, orderBy: { order: "desc" } });
    const c = await db.course.create({ data: { ...data, code: req(f, "code", "mã khóa").toUpperCase(), order: (last?.order ?? 0) + 1 } });
    await audit(user.id, "create", "Course", c.id);
    return `Đã thêm khóa ${c.name}.`;
  }, PATHS);
}

export async function updateCourse(courseId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    await db.course.update({ where: { id: courseId }, data: readCourse(f) });
    await audit(user.id, "update", "Course", courseId);
    return "Đã lưu khóa học. Lớp đã mở giữ nguyên học phí cũ.";
  }, PATHS);
}

/** Xóa nếu chưa có lớp nào dùng, ngược lại chỉ ẩn khỏi danh sách. */
export async function deleteCourse(courseId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    const used = await db.class.count({ where: { courseId } });
    if (used) {
      await db.course.update({ where: { id: courseId }, data: { active: false } });
      await audit(user.id, "deactivate", "Course", courseId);
      return `Khóa đã có ${used} lớp nên được ẩn khỏi bảng giá thay vì xóa.`;
    }
    await db.course.delete({ where: { id: courseId } });
    await audit(user.id, "delete", "Course", courseId);
    return "Đã xóa khóa học.";
  }, PATHS);
}
