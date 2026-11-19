"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { planSessions, type ScheduleRule } from "@/lib/schedule/generate";
import { syncClassSessions } from "@/lib/schedule/sync";
import { addDays, todayVN, toDate, toDay } from "@/lib/dates";
import type { ActionResult } from "@/components/ui/modal";
import { audit, day, int, opt, req, run, str, UserError } from "./util";

type Rule = { weekday: number; startTime: string; endTime: string };

function readRules(f: FormData): Rule[] {
  const rules: Rule[] = [];
  for (let wd = 0; wd < 7; wd++) {
    if (!f.get(`wd${wd}`)) continue;
    const startTime = str(f, `s${wd}`);
    const endTime = str(f, `e${wd}`);
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || endTime <= startTime) {
      throw new UserError("Giờ học chưa hợp lệ: giờ kết thúc phải sau giờ bắt đầu.");
    }
    rules.push({ weekday: wd, startTime, endTime });
  }
  if (rules.length === 0) throw new UserError("Chọn ít nhất một buổi học trong tuần.");
  return rules;
}

async function readClass(f: FormData) {
  const courseId = req(f, "courseId", "khóa học");
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, include: { program: true } });
  const subject = await db.subject.findFirst({ where: { name: course.program.code === "HSK" ? "Tiếng Trung" : "Tiếng Anh" } });
  const startDate = day(f, "startDate", "ngày khai giảng");
  const perSession = course.priceUnit === "SESSION";
  return {
    name: req(f, "name", "tên lớp"),
    courseId,
    teacherId: opt(f, "teacherId"),
    roomId: int(f, "roomId"),
    gradeId: int(f, "gradeId"),
    subjectId: subject?.id ?? null,
    color: str(f, "color") || course.program.color,
    startDate,
    totalSessions: perSession ? null : int(f, "totalSessions"),
    maxStudents: int(f, "maxStudents"),
    unitPrice: int(f, "unitPrice") ?? course.listedPrice,
    feeMode: perSession ? ("PER_SESSION" as const) : ("COURSE" as const),
  };
}

/** Ngày của buổi thứ `n` tính từ `from` theo lịch. */
function nthDate(rules: Rule[], from: string, n: number) {
  const r: ScheduleRule[] = rules.map((x) => ({ ...x, validFrom: from }));
  const planned = planSessions(r, { from, to: addDays(from, 1000) }, from);
  return planned[n - 1]?.date ?? null;
}

export async function createClass(_: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    const code = req(f, "code", "mã lớp").toUpperCase().replace(/\s+/g, "-");
    const data = await readClass(f);
    const rules = readRules(f);
    const branch = await db.branch.findFirstOrThrow();
    const endDate = data.totalSessions ? nthDate(rules, data.startDate, data.totalSessions) : null;
    const today = todayVN();
    const cls = await db.class.create({
      data: {
        ...data, code, branchId: branch.id, startDate: toDate(data.startDate), endDate: endDate ? toDate(endDate) : null,
        status: endDate && endDate < today ? "ENDED" : "OPEN",
        schedules: { create: rules.map((r) => ({ ...r, validFrom: toDate(data.startDate) })) },
      },
    });
    const n = await syncClassSessions(db, cls.id, { from: data.startDate, to: endDate ?? addDays(today, 90) });
    await audit(user.id, "create", "Class", cls.id, { code });
    return `Đã tạo lớp ${cls.name} và sinh ${n} buổi học.`;
  }, ["/lop-hoc", "/lich-hoc", "/"]);
}

export async function updateClass(classId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    const data = await readClass(f);
    const rules = readRules(f);
    const today = todayVN();
    const cls = await db.class.findUniqueOrThrow({ where: { id: classId }, include: { schedules: { where: { validTo: null } } } });
    const hasAttendance = (await db.attendance.count({ where: { session: { classId } } })) > 0;
    const sameRules = cls.schedules.length === rules.length && rules.every((r) => cls.schedules.some((s) => s.weekday === r.weekday && s.startTime === r.startTime && s.endTime === r.endTime));
    const startChanged = toDay(cls.startDate) !== data.startDate;
    if (startChanged && hasAttendance) throw new UserError("Lớp đã có điểm danh nên không đổi được ngày khai giảng.");

    await db.$transaction(async (tx) => {
      // Từ ngày áp dụng lịch mới, xóa các buổi tự sinh chưa điểm danh để sinh lại.
      const effective = !hasAttendance ? data.startDate : today > data.startDate ? today : data.startDate;
      if (!sameRules || startChanged || cls.totalSessions !== data.totalSessions) {
        if (!sameRules || startChanged) {
          await tx.classSchedule.deleteMany({ where: { classId, validFrom: { gte: toDate(effective) } } });
          await tx.classSchedule.updateMany({ where: { classId, validTo: null }, data: { validTo: toDate(addDays(effective, -1)) } });
          await tx.classSchedule.createMany({ data: rules.map((r) => ({ ...r, classId, validFrom: toDate(effective) })) });
        }
        await tx.session.deleteMany({ where: { classId, source: "SCHEDULE", status: "SCHEDULED", date: { gte: toDate(effective) }, attendance: { none: {} } } });
      }
      let endDate: string | null = null;
      if (data.totalSessions) {
        const done = await tx.session.count({ where: { classId, status: "SCHEDULED", date: { lt: toDate(effective) } } });
        const remain = data.totalSessions - done;
        endDate = remain > 0 ? nthDate(rules, effective, remain) : addDays(effective, -1);
      }
      await tx.class.update({
        where: { id: classId },
        data: { ...data, startDate: toDate(data.startDate), endDate: endDate ? toDate(endDate) : null },
      });
      await syncClassSessions(tx, classId, { from: effective, to: endDate ?? addDays(today, 90) });
    });
    await audit(user.id, "update", "Class", classId);
    return "Đã lưu thay đổi của lớp.";
  }, ["/lop-hoc", "/lich-hoc", "/"]);
}

export async function setClassStatus(classId: string, status: "OPEN" | "ENDED", _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("class.manage");
    await db.class.update({ where: { id: classId }, data: { status } });
    if (status === "ENDED") await db.enrollment.updateMany({ where: { classId, status: "ACTIVE" }, data: { status: "LEFT", leaveDate: toDate(todayVN()) } });
    await audit(user.id, status === "ENDED" ? "end" : "reopen", "Class", classId);
    return status === "ENDED" ? "Đã kết thúc lớp." : "Đã mở lại lớp.";
  }, ["/lop-hoc", "/lich-hoc", "/"]);
}

export async function deleteClass(classId: string, _: ActionResult) {
  const r = await run(async () => {
    const user = await requirePermission("class.manage");
    const [att, pays] = await Promise.all([
      db.attendance.count({ where: { session: { classId } } }),
      db.payment.count({ where: { classId, voidedAt: null } }),
    ]);
    if (att || pays) throw new UserError("Lớp đã có điểm danh hoặc đã thu học phí nên không xóa được. Hãy dùng “Kết thúc lớp”.");
    await db.$transaction([
      db.enrollment.deleteMany({ where: { classId } }),
      db.class.delete({ where: { id: classId } }),
    ]);
    await audit(user.id, "delete", "Class", classId);
  }, ["/lop-hoc", "/lich-hoc", "/"]);
  if (r.ok) redirect("/lop-hoc");
  return r;
}
