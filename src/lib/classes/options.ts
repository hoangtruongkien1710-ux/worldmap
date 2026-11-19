import { db } from "@/lib/db";
import type { ClassOptions } from "@/components/classes/forms";

/** Danh sách chọn cho form tạo / sửa lớp. */
export async function loadClassOptions(): Promise<ClassOptions> {
  const [courses, teachers, rooms, grades] = await Promise.all([
    db.course.findMany({ where: { active: true }, include: { program: true }, orderBy: [{ program: { order: "asc" } }, { order: "asc" }] }),
    db.user.findMany({ where: { role: "TEACHER", active: true }, orderBy: { fullName: "asc" } }),
    db.room.findMany({ orderBy: { name: "asc" } }),
    db.grade.findMany({ orderBy: { order: "asc" } }),
  ]);
  return { courses, teachers, rooms, grades };
}
