import { db } from "@/lib/db";
import { addDays, monthRange, shiftMonth, toDate, toDay, todayVN } from "@/lib/dates";
import { tuitionSheets, type FeeSheet } from "./month";

/**
 * Số liệu cho trang Báo cáo của khu lớp học: doanh thu học phí, chuyên cần,
 * học viên và lớp học trong một tháng, kèm tháng trước để so sánh.
 */
export async function classroomReport(month: string) {
  const prevMonth = shiftMonth(month, -1);
  const today = todayVN();
  const first12 = shiftMonth(month, -11);
  const [sheetsAll, payments, classes, enrollments, sessions] = await Promise.all([
    tuitionSheets(),
    db.payment.findMany({ where: { voidedAt: null, paidAt: { gte: toDate(`${first12}-01`), lt: toDate(addDays(monthRange(month).to, 1)) } }, select: { amount: true, paidAt: true, classId: true } }),
    db.class.findMany({ include: { teacher: { select: { fullName: true } } }, orderBy: [{ status: "asc" }, { name: "asc" }] }),
    db.enrollment.findMany({ include: { student: { include: { grade: true } } } }),
    db.session.findMany({
      where: { date: { gte: toDate(`${prevMonth}-01`), lte: toDate(monthRange(month).to) } },
      include: { attendance: { select: { studentId: true, status: true } } },
    }),
  ]);
  const byMonth = (m: string) => sheetsAll.filter((s) => s.month === m);
  const sheets = byMonth(month), prevSheets = byMonth(prevMonth);
  const sum = (xs: FeeSheet[], k: "total" | "paid" | "remain") => xs.reduce((s, x) => s + x[k], 0);
  const cashIn = (m: string) => payments.filter((p) => toDay(p.paidAt).startsWith(m)).reduce((s, p) => s + p.amount, 0);

  // ---- Doanh thu
  const perClass = (xs: FeeSheet[]) => {
    const m = new Map<string, { due: number; paid: number; remain: number; n: number }>();
    for (const s of xs) for (const i of s.items) {
      const v = m.get(i.classId) ?? { due: 0, paid: 0, remain: 0, n: 0 };
      v.due += i.amount; v.paid += i.paid; v.remain += i.remain; v.n += 1;
      m.set(i.classId, v);
    }
    return m;
  };
  const cur = perClass(sheets), prev = perClass(prevSheets);
  const revenueRows = classes.filter((c) => cur.has(c.id) || prev.has(c.id)).map((c) => {
    const a = cur.get(c.id), b = prev.get(c.id);
    return { id: c.id, name: c.name, color: c.color, n: a?.n ?? 0, due: a?.due ?? 0, prevDue: b?.due ?? 0, paid: a?.paid ?? 0, remain: a?.remain ?? 0 };
  });
  const months12 = Array.from({ length: 12 }, (_, i) => shiftMonth(first12, i));
  const revenue = {
    due: sum(sheets, "total"), prevDue: sum(prevSheets, "total"),
    paid: sum(sheets, "paid"), prevPaid: sum(prevSheets, "paid"),
    cash: cashIn(month), prevCash: cashIn(prevMonth),
    remain: sum(sheets, "remain"), prevRemain: sum(prevSheets, "remain"),
    rows: revenueRows,
    trend: months12.map((m) => ({ month: m, due: sum(byMonth(m), "total"), cash: cashIn(m) })),
  };

  // ---- Chuyên cần (chỉ buổi đã diễn ra, không tính buổi hủy)
  const held = (m: string) => sessions.filter((s) => s.status === "SCHEDULED" && toDay(s.date).startsWith(m) && toDay(s.date) <= today);
  const att = (m: string) => {
    const ss = held(m);
    const marks = ss.flatMap((s) => s.attendance.map((a) => ({ ...a, classId: s.classId })));
    const count = (st: string, xs = marks) => xs.filter((a) => a.status === st).length;
    return { ss, marks, count, sessions: ss.length, unmarked: ss.filter((s) => !s.attendance.length).length,
      rate: marks.length ? (count("PRESENT") / marks.length) * 100 : 0 };
  };
  const A = att(month), PA = att(prevMonth);
  const studentName = new Map(enrollments.map((e) => [e.studentId, e.student]));
  const absences = new Map<string, { absent: number; excused: number; total: number }>();
  for (const a of A.marks) {
    const v = absences.get(a.studentId) ?? { absent: 0, excused: 0, total: 0 };
    v.total++; if (a.status === "ABSENT") v.absent++; if (a.status === "EXCUSED") v.excused++;
    absences.set(a.studentId, v);
  }
  const attendance = {
    sessions: A.sessions, prevSessions: PA.sessions,
    rate: A.rate, prevRate: PA.rate,
    absent: A.count("ABSENT"), prevAbsent: PA.count("ABSENT"),
    excused: A.count("EXCUSED"), unmarked: A.unmarked, prevUnmarked: PA.unmarked,
    rows: classes.map((c) => {
      const mine = A.marks.filter((a) => a.classId === c.id), prevMine = PA.marks.filter((a) => a.classId === c.id);
      return { id: c.id, name: c.name, color: c.color, sessions: A.ss.filter((s) => s.classId === c.id).length, marks: mine.length,
        present: A.count("PRESENT", mine), excused: A.count("EXCUSED", mine), absent: A.count("ABSENT", mine),
        rate: mine.length ? (A.count("PRESENT", mine) / mine.length) * 100 : null,
        prevRate: prevMine.length ? (PA.count("PRESENT", prevMine) / prevMine.length) * 100 : null };
    }).filter((r) => r.sessions > 0),
    watch: [...absences.entries()].filter(([, v]) => v.absent + v.excused >= 2)
      .map(([id, v]) => ({ student: studentName.get(id)!, ...v })).sort((a, b) => b.absent - a.absent || b.excused - a.excused).slice(0, 15),
  };

  // ---- Học viên: đang học tại cuối tháng = vào học trước cuối tháng và chưa nghỉ
  const end = (m: string) => toDate(monthRange(m).to);
  const activeAt = (m: string) => enrollments.filter((e) => e.joinDate <= end(m) && (!e.leaveDate || e.leaveDate > end(m)) && (e.status === "ACTIVE" || e.leaveDate));
  const studentsAt = (m: string) => new Map(activeAt(m).map((e) => [e.studentId, e.student]));
  const firstJoin = new Map<string, Date>();
  for (const e of enrollments) { const d = firstJoin.get(e.studentId); if (!d || e.joinDate < d) firstJoin.set(e.studentId, e.joinDate); }
  const newIn = (m: string) => [...firstJoin.entries()].filter(([, d]) => toDay(d).startsWith(m)).map(([id]) => studentName.get(id)!);
  const leftIn = (m: string) => enrollments.filter((e) => e.leaveDate && toDay(e.leaveDate).startsWith(m));
  const S = studentsAt(month), PS = studentsAt(prevMonth);
  const gradeCount = (map: Map<string, (typeof enrollments)[number]["student"]>) => {
    const g = new Map<string, number>();
    for (const s of map.values()) { const k = s.grade?.name ?? "Người lớn / khác"; g.set(k, (g.get(k) ?? 0) + 1); }
    return g;
  };
  const G = gradeCount(S), PG = gradeCount(PS);
  const debtors = new Set(sheetsAll.filter((s) => s.remain > 0 && s.month <= month).map((s) => s.student.id));
  const students = {
    active: S.size, prevActive: PS.size,
    newStudents: newIn(month), prevNew: newIn(prevMonth).length,
    left: leftIn(month).map((e) => ({ student: e.student, className: classes.find((c) => c.id === e.classId)?.name ?? "", date: e.leaveDate! })),
    prevLeft: leftIn(prevMonth).length,
    debtors: debtors.size,
    grades: [...new Set([...G.keys(), ...PG.keys()])].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })).map((k) => ({ name: k, now: G.get(k) ?? 0, prev: PG.get(k) ?? 0 })),
    joinedAt: (id: string) => firstJoin.get(id),
  };

  // ---- Lớp học
  const classRows = classes.filter((c) => c.status === "OPEN" || activeAt(month).some((e) => e.classId === c.id) || cur.has(c.id)).map((c) => {
    const size = activeAt(month).filter((e) => e.classId === c.id).length;
    const prevSize = activeAt(prevMonth).filter((e) => e.classId === c.id).length;
    const all = sessions.filter((s) => s.classId === c.id && toDay(s.date).startsWith(month));
    const r = attendance.rows.find((x) => x.id === c.id);
    const fee = cur.get(c.id);
    return { id: c.id, code: c.code, name: c.name, color: c.color, teacher: c.teacher?.fullName ?? null, status: c.status, max: c.maxStudents,
      size, prevSize, planned: all.filter((s) => s.status === "SCHEDULED").length, cancelled: all.filter((s) => s.status === "CANCELLED").length,
      held: r?.sessions ?? 0, rate: r?.rate ?? null, due: fee?.due ?? 0, paid: fee?.paid ?? 0 };
  });
  const open = classRows.filter((c) => c.status === "OPEN");
  const classesInfo = {
    open: open.length, prevOpen: classes.filter((c) => c.startDate <= end(prevMonth) && (!c.endDate || c.endDate >= toDate(`${prevMonth}-01`))).length,
    avgSize: open.length ? open.reduce((s, c) => s + c.size, 0) / open.length : 0,
    planned: classRows.reduce((s, c) => s + c.planned, 0), cancelled: classRows.reduce((s, c) => s + c.cancelled, 0),
    newClasses: classes.filter((c) => toDay(c.startDate).startsWith(month)).length,
    full: open.filter((c) => c.max && c.size >= c.max * 0.9).length,
    rows: classRows,
  };

  return { month, prevMonth, revenue, attendance, students, classes: classesInfo };
}
export type ClassroomReport = Awaited<ReturnType<typeof classroomReport>>;
