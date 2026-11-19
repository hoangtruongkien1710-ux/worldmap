import { db } from "@/lib/db";
import { monthOf, todayVN, toDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { enrollmentDue } from "./service";
import type { InvoiceItem } from "./summary";

export type FeeItem = {
  key: string; enrollmentId: string | null; classId: string; className: string; classCode: string; color: string;
  gross: number; discount: number; amount: number; paid: number; remain: number; locked: boolean; how: string;
};
export type FeePayment = { id: string; amount: number; paidAt: Date; method: string; note: string | null; txnRef: string | null; voidedAt: Date | null; className: string };
export type FeeSheet = {
  key: string; invoiceId: string | null; month: string;
  student: { id: string; code: string; fullName: string; phone: string | null; parentName: string | null; parentRelation: string | null; parentPhone: string | null; grade: { id: number; name: string } | null };
  items: FeeItem[]; total: number; paid: number; remain: number; payments: FeePayment[];
  status: "paid" | "part" | "unpaid";
};

const statusOf = (total: number, paid: number) => (paid >= total ? "paid" : paid > 0 ? "part" : "unpaid") as FeeSheet["status"];

/**
 * Phiếu học phí gộp theo học viên. Mỗi phiếu thuộc một tháng (tháng chốt học phí).
 * Ghi danh chưa chốt học phí được gộp vào tháng hiện tại để còn thu được.
 * `month` bỏ trống = mọi tháng.
 */
export async function tuitionSheets(month?: string): Promise<FeeSheet[]> {
  const today = todayVN();
  const current = monthOf(today);
  const [invoices, classes, enrollments] = await Promise.all([
    db.invoice.findMany({
      where: month ? { month } : {},
      include: { student: { include: { grade: true } }, payments: { orderBy: { paidAt: "asc" } } },
      orderBy: [{ month: "asc" }, { createdAt: "asc" }],
    }),
    db.class.findMany({ include: { sessions: { where: { status: "SCHEDULED" }, select: { date: true } } } }),
    db.enrollment.findMany({ include: { student: { include: { grade: true } } } }),
  ]);
  const cls = new Map(classes.map((c) => [c.id, c]));
  const enrollmentOf = (studentId: string, classId: string) => enrollments.find((e) => e.studentId === studentId && e.classId === classId);
  const howOf = (classId: string, it: { gross: number; discount: number; amount: number; note?: string }) => {
    const c = cls.get(classId);
    if (!c) return money(it.amount);
    const base = c.feeMode === "PER_SESSION" ? `${money(c.unitPrice)} × ${it.note ?? `${Math.round(it.gross / (c.unitPrice || 1))} buổi`}` : `Trọn khóa${c.totalSessions ? ` ${c.totalSessions} buổi` : ""} ${money(it.gross)}`;
    return it.discount ? `${base} − ưu đãi ${money(it.discount)}` : base;
  };

  const sheets: FeeSheet[] = invoices.map((inv) => {
    const detail = (inv.lockedDetail ?? []) as InvoiceItem[];
    const total = inv.lockedAmount ?? detail.reduce((s, it) => s + it.amount, 0);
    const active = inv.payments.filter((p) => !p.voidedAt);
    const items: FeeItem[] = detail.map((it, i) => {
      const share = total ? it.amount / total : 0;
      // Lần thu ghi rõ lớp tính đủ; lần thu cũ chưa ghi lớp thì chia theo tỷ lệ.
      const paid = Math.min(it.amount, active.reduce((s, p) => s + (p.classId === it.classId ? p.amount : p.classId ? 0 : Math.round(p.amount * share)), 0));
      const c = cls.get(it.classId);
      return {
        key: `${inv.id}-${i}`, enrollmentId: enrollmentOf(inv.studentId, it.classId)?.id ?? null, classId: it.classId, className: it.className,
        classCode: c?.code ?? "", color: c?.color ?? "#94a3b8", gross: it.gross, discount: it.discount, amount: it.amount, paid, remain: Math.max(0, it.amount - paid),
        locked: true, how: howOf(it.classId, it),
      };
    });
    const paid = active.reduce((s, p) => s + p.amount, 0);
    return {
      key: inv.id, invoiceId: inv.id, month: inv.month, student: inv.student, items, total, paid: Math.min(paid, total), remain: Math.max(0, total - paid),
      payments: inv.payments.map((p) => ({ ...p, className: detail.find((d) => d.classId === p.classId)?.className ?? detail[0]?.className ?? "" })),
      status: statusOf(total, paid),
    };
  });

  // Ghi danh đang học nhưng chưa chốt học phí (VD: lớp 1-1 tính theo buổi, học viên mới vào).
  if (!month || month === current) {
    const lockedKeys = new Set((await db.invoice.findMany({ select: { studentId: true, lockedDetail: true } }))
      .flatMap((i) => ((i.lockedDetail ?? []) as InvoiceItem[]).map((it) => `${i.studentId}:${it.classId}`)));
    for (const e of enrollments) {
      if (e.status !== "ACTIVE" || lockedKeys.has(`${e.studentId}:${e.classId}`)) continue;
      const c = cls.get(e.classId);
      if (!c) continue;
      const held = c.sessions.filter((s) => s.date >= e.joinDate && toDay(s.date) <= today).length;
      const due = enrollmentDue(c, e.percentDiscount, held);
      if (due.amount <= 0) continue;
      const item: FeeItem = {
        key: `pending-${e.id}`, enrollmentId: e.id, classId: c.id, className: c.name, classCode: c.code, color: c.color,
        gross: due.gross, discount: due.discount, amount: due.amount, paid: 0, remain: due.amount, locked: false,
        how: `${howOf(c.id, { ...due, note: c.feeMode === "PER_SESSION" ? `${held} buổi đã học` : undefined })} · chưa chốt`,
      };
      let sheet = sheets.find((s) => s.student.id === e.studentId && s.month === current);
      if (!sheet) {
        sheet = { key: `pending-${e.studentId}`, invoiceId: null, month: current, student: e.student, items: [], total: 0, paid: 0, remain: 0, payments: [], status: "unpaid" };
        sheets.push(sheet);
      }
      sheet.items.push(item);
      sheet.total += item.amount;
      sheet.remain += item.amount;
      sheet.status = statusOf(sheet.total, sheet.paid);
    }
  }
  return sheets;
}

export const monthShort = (m: string) => `T${Number(m.slice(5))}/${m.slice(2, 4)}`;

export type SheetQuery = { q?: string; lop?: string; khoi?: string; tt?: string };
export const STATUS_PARAM: Record<string, FeeSheet["status"]> = { "da-du": "paid", "mot-phan": "part", "chua-thu": "unpaid" };

/** Lọc phiếu theo ô tìm kiếm, lớp (mã lớp), khối (id) và trạng thái. */
export function filterSheets(sheets: FeeSheet[], f: SheetQuery) {
  const q = f.q?.trim().toLowerCase();
  return sheets.filter((s) =>
    (!q || [s.student.fullName, s.student.code, s.student.parentName, s.student.parentPhone, s.student.phone, s.invoiceId]
      .some((v) => v?.toLowerCase().includes(q))) &&
    (!f.lop || s.items.some((i) => i.classCode === f.lop)) &&
    (!f.khoi || String(s.student.grade?.id ?? "") === f.khoi) &&
    (!f.tt || s.status === STATUS_PARAM[f.tt]));
}

export type DebtRow = { student: FeeSheet["student"]; sheets: FeeSheet[]; total: number; overdue: number };

/** Gom các phiếu còn nợ (mọi tháng) theo học viên, nợ nhiều xếp trước. */
export function debtRows(sheets: FeeSheet[], current: string): DebtRow[] {
  const map = new Map<string, DebtRow>();
  for (const s of sheets) {
    if (s.remain <= 0) continue;
    const r = map.get(s.student.id) ?? { student: s.student, sheets: [], total: 0, overdue: 0 };
    r.sheets.push(s);
    r.total += s.remain;
    if (s.month < current) r.overdue += s.remain;
    map.set(s.student.id, r);
  }
  return [...map.values()]
    .map((r) => ({ ...r, sheets: r.sheets.sort((a, b) => a.month.localeCompare(b.month)) }))
    .sort((a, b) => b.total - a.total);
}
