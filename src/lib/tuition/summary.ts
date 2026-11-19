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
