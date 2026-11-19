import { db } from "@/lib/db";

export type InvoiceItem = { classId: string; className: string; gross: number; discount: number; amount: number; note?: string };

/** Phiếu học phí đã chốt kèm số đã thu, còn nợ. Lọc theo học viên nếu cần. */
export async function loadInvoices(where: { studentId?: string | { in: string[] } } = {}) {
  const rows = await db.invoice.findMany({
    where,
    include: { student: { include: { grade: true } }, payments: { where: { voidedAt: null }, orderBy: { paidAt: "asc" } } },
    orderBy: [{ month: "desc" }, { createdAt: "asc" }],
  });
  return rows.map((i) => {
    const total = i.lockedAmount ?? 0;
    const paid = i.payments.reduce((s, p) => s + p.amount, 0);
    return { ...i, total, paid, remain: Math.max(0, total - paid), items: (i.lockedDetail ?? []) as InvoiceItem[] };
  });
}

export type InvoiceRow = Awaited<ReturnType<typeof loadInvoices>>[number];

/** Chia số đã thu của một phiếu cho từng lớp theo tỷ lệ phải thu (phiếu gộp nhiều lớp). */
export function byClass(invoices: InvoiceRow[]) {
  const map = new Map<string, { due: number; paid: number; students: Set<string>; debtors: Set<string> }>();
  for (const inv of invoices) {
    for (const it of inv.items) {
      const share = inv.total ? it.amount / inv.total : 0;
      const v = map.get(it.classId) ?? { due: 0, paid: 0, students: new Set(), debtors: new Set() };
      v.due += it.amount;
      v.paid += Math.round(inv.paid * share);
      v.students.add(inv.studentId);
      if (inv.remain > 0) v.debtors.add(inv.studentId);
      map.set(it.classId, v);
    }
  }
  return map;
}

/** Học phí từng học viên trong một lớp: phải thu, đã thu (từng lần), còn lại. */
export async function classTuition(classId: string, today: string) {
  const { enrollmentDue } = await import("./service");
  const cls = await db.class.findUniqueOrThrow({ where: { id: classId }, include: { sessions: { where: { status: "SCHEDULED" }, select: { date: true } } } });
  const enrollments = await db.enrollment.findMany({ where: { classId }, include: { student: { include: { grade: true } } }, orderBy: { student: { fullName: "asc" } } });
  const invoices = await db.invoice.findMany({
    where: { studentId: { in: enrollments.map((e) => e.studentId) } },
    include: { payments: { orderBy: { paidAt: "asc" } } },
  });
  return enrollments.map((e) => {
    const mine = invoices.filter((i) => i.studentId === e.studentId);
    const inv = mine.find((i) => ((i.lockedDetail ?? []) as InvoiceItem[]).some((it) => it.classId === classId));
    const item = inv ? ((inv.lockedDetail ?? []) as InvoiceItem[]).find((it) => it.classId === classId)! : null;
    const held = cls.sessions.filter((s) => s.date >= e.joinDate && s.date.toISOString().slice(0, 10) <= today && (!e.leaveDate || s.date <= e.leaveDate)).length;
    const calc = enrollmentDue(cls, e.percentDiscount, held);
    const due = item ? item.amount : calc.amount;
    const share = inv && item && (inv.lockedAmount ?? 0) > 0 ? item.amount / (inv.lockedAmount ?? 1) : 0;
    // Lần thu ghi rõ lớp; lần thu cũ (chưa ghi lớp) thì chia theo tỷ lệ phải thu.
    const payments = mine.flatMap((i) => i.payments.filter((p) => p.classId === classId || (!p.classId && i.id === inv?.id)));
    const active = payments.filter((p) => !p.voidedAt);
    const paid = active.reduce((s, p) => s + (p.classId === classId ? p.amount : Math.round(p.amount * share)), 0);
    return {
      enrollment: e, student: e.student, locked: !!item, gross: item?.gross ?? calc.gross, discount: item?.discount ?? calc.discount,
      due, paid, remain: Math.max(0, due - paid), payments, held,
    };
  });
}
