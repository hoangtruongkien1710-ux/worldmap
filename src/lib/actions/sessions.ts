"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { todayVN, toDate } from "@/lib/dates";
import type { ActionResult } from "@/components/ui/modal";
import type { AttendanceStatus } from "@prisma/client";
import { audit, day, opt, req, run, str, time, UserError } from "./util";

const PATHS = ["/lop-hoc", "/lich-hoc", "/hoc-sinh", "/"];

/** Lưu điểm danh một buổi: trạng thái từng học viên + nội dung dạy, bài tập. */
export async function saveAttendance(sessionId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("attendance.take");
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { class: true } });
    if (user.role === "TEACHER" && s.class.teacherId !== user.id) throw new UserError("Bạn chỉ điểm danh được lớp mình dạy.");
    if (s.status === "CANCELLED") throw new UserError("Buổi này đã cho nghỉ.");
    if (s.date > toDate(todayVN())) throw new UserError("Chưa đến ngày học, chưa điểm danh được.");
    const rows: { studentId: string; status: AttendanceStatus; note: string | null }[] = [];
    for (const [k, v] of f.entries()) {
      if (!k.startsWith("st_")) continue;
      const status = String(v);
      if (!["PRESENT", "EXCUSED", "ABSENT"].includes(status)) continue;
      const studentId = k.slice(3);
      rows.push({ studentId, status: status as AttendanceStatus, note: opt(f, `note_${studentId}`) });
    }
    await db.$transaction(async (tx) => {
      for (const r of rows) {
        await tx.attendance.upsert({
          where: { sessionId_studentId: { sessionId, studentId: r.studentId } },
          update: { status: r.status, note: r.note, updatedById: user.id },
          create: { sessionId, studentId: r.studentId, status: r.status, note: r.note, updatedById: user.id },
        });
      }
      await tx.session.update({ where: { id: sessionId }, data: { taughtContent: opt(f, "taughtContent"), homework: opt(f, "homework") } });
    });
    await audit(user.id, "attendance", "Session", sessionId, { n: rows.length });
    return `Đã lưu điểm danh ${rows.length} học viên.`;
  }, PATHS);
}

export async function cancelSession(sessionId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    const reason = req(f, "cancelReason", "lý do nghỉ");
    const n = await db.attendance.count({ where: { sessionId } });
    if (n && !f.get("confirmClear")) throw new UserError("Buổi này đã có điểm danh. Tích ô xác nhận để xóa điểm danh và cho nghỉ.");
    await db.$transaction([
      db.attendance.deleteMany({ where: { sessionId } }),
      db.session.update({ where: { id: sessionId }, data: { status: "CANCELLED", cancelReason: reason } }),
    ]);
    await audit(user.id, "cancel", "Session", sessionId, { reason });
    return "Đã cho nghỉ buổi học.";
  }, PATHS);
}

export async function restoreSession(sessionId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    await db.session.update({ where: { id: sessionId }, data: { status: "SCHEDULED", cancelReason: null } });
    await audit(user.id, "restore", "Session", sessionId);
    return "Đã khôi phục buổi học.";
  }, PATHS);
}

/** Thêm buổi học bù hoặc buổi học thêm (thi thử, ôn tập…). */
export async function addSession(classId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    const date = day(f, "date", "ngày học");
    const startTime = time(f, "startTime", "bắt đầu");
    const endTime = time(f, "endTime", "kết thúc");
    if (endTime <= startTime) throw new UserError("Giờ kết thúc phải sau giờ bắt đầu.");
    const source = str(f, "source") === "MANUAL" ? "MANUAL" : "MAKEUP";
    const clash = await db.session.findFirst({ where: { classId, date: toDate(date), startTime } });
    if (clash) throw new UserError("Lớp đã có buổi học vào giờ này.");
    const s = await db.session.create({ data: { classId, date: toDate(date), startTime, endTime, source, taughtContent: opt(f, "taughtContent") } });
    await audit(user.id, "create", "Session", s.id, { source });
    return source === "MAKEUP" ? "Đã thêm buổi học bù." : "Đã thêm buổi học.";
  }, PATHS);
}

/** Xóa buổi học bù / buổi thêm chưa điểm danh. */
export async function deleteSession(sessionId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { _count: { select: { attendance: true } } } });
    if (s.source === "SCHEDULE") throw new UserError("Buổi theo lịch cố định không xóa được, hãy dùng “Cho nghỉ”.");
    if (s._count.attendance) throw new UserError("Buổi đã có điểm danh nên không xóa được.");
    await db.session.delete({ where: { id: sessionId } });
    await audit(user.id, "delete", "Session", sessionId);
  }, PATHS);
}
