"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { todayVN, toDate } from "@/lib/dates";
import type { ActionResult } from "@/components/ui/modal";
import { audit, day, int, opt, req, run, str, UserError } from "./util";

const PATHS = ["/hoc-sinh", "/lop-hoc", "/hoc-phi", "/cong-no", "/"];

function readStudent(f: FormData) {
  const parentPhone = opt(f, "parentPhone");
  const phone = opt(f, "phone");
  for (const [k, v] of [["parentPhone", parentPhone], ["phone", phone]] as const) if (v && !/^0\d{9,10}$/.test(v.replace(/\s/g, ""))) throw new UserError("Số điện thoại phải có 10–11 chữ số, bắt đầu bằng 0.", k);
  return {
    fullName: (() => { const n = req(f, "fullName", "họ tên"); if (n.length > 60) throw new UserError("Họ tên tối đa 60 ký tự.", "fullName"); return n; })(),
    gradeId: int(f, "gradeId"),
    school: opt(f, "school"),
    parentName: opt(f, "parentName"),
    parentRelation: opt(f, "parentRelation"),
    parentPhone: parentPhone?.replace(/\s/g, "") ?? null,
    phone: phone?.replace(/\s/g, "") ?? null,
    note: opt(f, "note"),
  };
}

async function nextStudentCode() {
  const last = await db.student.findFirst({ where: { code: { startsWith: "HV" } }, orderBy: { code: "desc" }, select: { code: true } });
  return `HV${String((last ? Number(last.code.slice(2)) : 0) + 1).padStart(4, "0")}`;
}

/** Thêm học viên mới; nếu có classId thì ghi danh luôn vào lớp. */
export async function createStudent(classId: string | null, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("student.manage");
    const data = readStudent(f);
    const branch = await db.branch.findFirstOrThrow();
    const code = await nextStudentCode();
    const s = await db.student.create({ data: { ...data, code, branchId: branch.id } });
    const cls = classId || opt(f, "classId");
    if (cls) {
      await db.enrollment.create({
        data: { studentId: s.id, classId: cls, joinDate: toDate(str(f, "joinDate") || todayVN()), percentDiscount: int(f, "percentDiscount") ?? 0 },
      });
    }
    await audit(user.id, "create", "Student", s.id, { code });
    return `Đã thêm học viên ${s.fullName} (${code}).`;
  }, PATHS);
}

export async function updateStudent(studentId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("student.manage");
    const data = readStudent(f);
    const status = str(f, "status") === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    await db.student.update({ where: { id: studentId }, data: { ...data, status } });
    await audit(user.id, "update", "Student", studentId);
    return "Đã lưu hồ sơ học viên.";
  }, PATHS);
}

export async function deleteStudent(studentId: string, _: ActionResult) {
  const r = await run(async () => {
    const user = await requirePermission("student.manage");
    const [att, inv] = await Promise.all([db.attendance.count({ where: { studentId } }), db.invoice.count({ where: { studentId } })]);
    if (att || inv) throw new UserError("Học viên đã có điểm danh hoặc học phí nên không xóa được. Hãy sửa trạng thái thành “Đã nghỉ”.");
    await db.$transaction([db.enrollment.deleteMany({ where: { studentId } }), db.student.delete({ where: { id: studentId } })]);
    await audit(user.id, "delete", "Student", studentId);
  }, PATHS);
  if (r.ok) redirect("/hoc-sinh");
  return r;
}

/** Thêm nhiều học viên có sẵn vào lớp cùng lúc. */
export async function enrollStudents(classIdArg: string | null, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    const classId = classIdArg || req(f, "classId", "lớp");
    const ids = f.getAll("studentIds").map(String).filter(Boolean);
    if (ids.length === 0) throw new UserError("Chọn ít nhất một học viên.");
    const joinDate = day(f, "joinDate", "ngày vào học");
    const percentDiscount = int(f, "percentDiscount") ?? 0;
    let n = 0;
    for (const studentId of ids) {
      const ex = await db.enrollment.findFirst({ where: { classId, studentId } });
      if (ex) {
        if (ex.status === "LEFT") { await db.enrollment.update({ where: { id: ex.id }, data: { status: "ACTIVE", leaveDate: null, joinDate: toDate(joinDate) } }); n++; }
        continue;
      }
      await db.enrollment.create({ data: { classId, studentId, joinDate: toDate(joinDate), percentDiscount } });
      n++;
    }
    await audit(user.id, "enroll", "Class", classId, { ids });
    return `Đã thêm ${n} học viên vào lớp.`;
  }, PATHS);
}

export async function updateEnrollment(enrollmentId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    const status = str(f, "status") === "LEFT" ? "LEFT" : "ACTIVE";
    const pct = int(f, "percentDiscount") ?? 0;
    if (pct < 0 || pct > 100) throw new UserError("Ưu đãi phải từ 0 đến 100%.", "percentDiscount");
    await db.enrollment.update({
      where: { id: enrollmentId },
      data: {
        joinDate: toDate(day(f, "joinDate", "ngày vào học")),
        percentDiscount: pct,
        status,
        leaveDate: status === "LEFT" ? toDate(str(f, "leaveDate") || todayVN()) : null,
      },
    });
    await audit(user.id, "update", "Enrollment", enrollmentId);
    return "Đã lưu ghi danh.";
  }, PATHS);
}

/** Cho nghỉ: giữ lịch sử điểm danh, học phí. */
export async function leaveEnrollment(enrollmentId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    await db.enrollment.update({ where: { id: enrollmentId }, data: { status: "LEFT", leaveDate: toDate(day(f, "leaveDate", "ngày nghỉ")) } });
    await audit(user.id, "leave", "Enrollment", enrollmentId);
    return "Đã cho học viên nghỉ lớp.";
  }, PATHS);
}

/** Xóa khỏi lớp: chỉ khi ghi danh nhầm (chưa có điểm danh, chưa thu tiền). */
export async function removeEnrollment(enrollmentId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    const e = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    const [att, pay] = await Promise.all([
      db.attendance.count({ where: { studentId: e.studentId, session: { classId: e.classId } } }),
      db.payment.count({ where: { classId: e.classId, invoice: { studentId: e.studentId }, voidedAt: null } }),
    ]);
    if (att || pay) throw new UserError("Học viên đã có điểm danh hoặc đã đóng tiền ở lớp này. Hãy dùng “Cho nghỉ”.");
    await db.enrollment.delete({ where: { id: enrollmentId } });
    await audit(user.id, "delete", "Enrollment", enrollmentId);
  }, PATHS);
}
