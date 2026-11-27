import { grossOf } from "./payroll";
import { db } from "@/lib/db";
import { toDate, toDay } from "@/lib/dates";
import { monthsIn, pickPeriod, type PeriodSP } from "./period";
import { ledgerSums, prevDay } from "./queries";
import { parseSort, sortRows } from "@/lib/sort";

/* Dữ liệu dùng chung cho màn hình và xuất Excel: cùng bộ lọc, cùng sắp xếp → file khớp với bảng đang xem. */

/* ---------------- Học phí ---------------- */
type FeeItem = { className: string; amount: number; discount: number; note?: string };
export type FeeSP = PeriodSP & { tt?: string; q?: string; xep?: string; chieu?: string };
export const FEE_SORT = ["hv", "thang", "lop", "phaithu", "dathu", "thucuoi", "conlai"];

export async function loadFees(sp: FeeSP) {
  const period = pickPeriod(sp, { defaultKey: "tatca" });
  const filter = sp.tt === "con-no" ? "debt" : sp.tt === "da-du" ? "paid" : "all";
  const m = monthsIn(period);
  const q = sp.q?.trim().toLowerCase();
  const invoices = await db.invoice.findMany({
    where: period.key === "tatca" ? {} : { month: { gte: m.from, lte: m.to } },
    include: { student: true, payments: { where: { voidedAt: null }, orderBy: { paidAt: "asc" } } },
    orderBy: [{ month: "desc" }, { createdAt: "desc" }],
  });
  const all = invoices
    .filter((i) => !q || [i.student.fullName, i.student.code, i.student.phone, i.student.parentPhone, i.student.parentName].some((v) => v?.toLowerCase().includes(q)))
    .map((i) => {
      const total = i.lockedAmount ?? 0;
      const paid = i.payments.reduce((s, p) => s + p.amount, 0);
      const items = (i.lockedDetail ?? []) as FeeItem[];
      return { ...i, total, paid, remain: total - paid, items, classes: items.map((x) => x.className).join(", "), lastPaid: i.payments.at(-1)?.paidAt ?? null };
    });
  const sort = parseSort(sp, FEE_SORT);
  // Mặc định: tháng học phí mới nhất trước, trong tháng thì lần thu gần nhất trước.
  const base = all.filter((r) => (filter === "debt" ? r.remain > 0 : filter === "paid" ? r.remain <= 0 : true))
    .sort((a, b) => b.month.localeCompare(a.month) || (b.lastPaid?.getTime() ?? 0) - (a.lastPaid?.getTime() ?? 0));
  const shown = sortRows(base, sort, {
    hv: (r) => r.student.fullName, thang: (r) => r.month, lop: (r) => r.classes, phaithu: (r) => r.total, dathu: (r) => r.paid, thucuoi: (r) => r.lastPaid, conlai: (r) => r.remain,
  });
  return { period, filter, all, shown, sort };
}

/* ---------------- Chi phí & mua hàng ---------------- */
export type ExpenseSP = PeriodSP & { q?: string; tt?: string; xep?: string; chieu?: string; xep2?: string; chieu2?: string };

export async function loadExpenses(sp: ExpenseSP) {
  const period = pickPeriod(sp);
  const { from, to } = period;
  const q = sp.q?.trim().toLowerCase();
  const [txns, payables, paidByPayable] = await Promise.all([
    db.cashTxn.findMany({
      where: { voidedAt: null, type: "OUT", date: { gte: toDate(from), lte: toDate(to) } },
      include: { category: true, account: true, supplier: true },
      orderBy: [{ date: "desc" }, { code: "desc" }],
    }),
    db.payable.findMany({ include: { supplier: true }, orderBy: [{ billDate: "desc" }, { code: "desc" }] }),
    db.cashTxn.groupBy({ by: ["payableId"], where: { voidedAt: null, payableId: { not: null } }, _sum: { amount: true } }),
  ]);
  const byCat = new Map<string, { name: string; amount: number; count: number }>();
  for (const t of txns) {
    const k = t.category?.code ?? "KHAC";
    const v = byCat.get(k) ?? { name: t.category?.name ?? "Khác", amount: 0, count: 0 };
    v.amount += t.amount;
    v.count += 1;
    byCat.set(k, v);
  }
  const cats = [...byCat.values()].sort((a, b) => b.amount - a.amount);
  const total = cats.reduce((s, c) => s + c.amount, 0);
  const paid = (id: string) => paidByPayable.find((p) => p.payableId === id)?._sum.amount ?? 0;
  const owing = payables.reduce((s, p) => s + Math.max(0, p.amount - paid(p.id)), 0);

  // Hóa đơn mua hàng trong kỳ (theo ngày hóa đơn), lọc theo tình trạng và từ khóa.
  const inPeriod = payables.filter((p) => toDay(p.billDate) >= from && toDay(p.billDate) <= to);
  const status = sp.tt === "con-no" ? "debt" : sp.tt === "da-tra" ? "paid" : "all";
  const bills = inPeriod
    .map((p) => ({ ...p, paidAmount: paid(p.id), remain: p.amount - paid(p.id) }))
    .filter((p) => (status === "debt" ? p.remain > 0 : status === "paid" ? p.remain <= 0 : true))
    .filter((p) => !q || [p.code, p.description, p.supplier?.name].some((v) => v?.toLowerCase().includes(q)));
  const billSort = parseSort(sp, ["hd", "ncc", "tien", "han", "conlai"]);
  const billRows = sortRows(bills, billSort, { hd: (p) => `${toDay(p.billDate)}|${p.code}`, ncc: (p) => p.supplier?.name, tien: (p) => p.amount, han: (p) => toDay(p.dueDate), conlai: (p) => p.remain });
  const vSort = parseSort(sp, ["ngay", "so", "dg", "km", "nguon", "tien"], ["xep2", "chieu2"]);
  const vRows = sortRows(txns, vSort, { ngay: (t) => `${toDay(t.date)}|${t.code}`, so: (t) => t.code, dg: (t) => t.description, km: (t) => t.category?.name, nguon: (t) => t.account.code, tien: (t) => t.amount });
  return { period, txns, payables, cats, total, owing, inPeriod, billRows, billSort, vRows, vSort };
}

/* ---------------- Bảng cân đối số phát sinh ---------------- */
export type TrialSP = PeriodSP & { q?: string; loai?: string; xep?: string; chieu?: string };
export const TRIAL_TYPES: Record<string, { label: string; cls: string }> = {
  ASSET: { label: "Tài sản", cls: "bg-sky-50 text-sky-700" },
  LIABILITY: { label: "Nợ phải trả", cls: "bg-orange-50 text-orange-700" },
  EQUITY: { label: "Vốn", cls: "bg-violet-50 text-violet-700" },
  REVENUE: { label: "Doanh thu", cls: "bg-emerald-50 text-emerald-700" },
  EXPENSE: { label: "Chi phí", cls: "bg-rose-50 text-rose-700" },
};

export async function loadTrial(sp: TrialSP) {
  const period = pickPeriod(sp);
  const { from, to } = period;
  const [accounts, before, during] = await Promise.all([
    db.ledgerAccount.findMany({ orderBy: { code: "asc" } }),
    ledgerSums(null, prevDay(from)),
    ledgerSums(from, to),
  ]);
  const z = { debit: 0, credit: 0 };
  // Chỉ hiện tài khoản chi tiết (không có tài khoản con) và có số liệu.
  const leaves = accounts.filter((a) => !accounts.some((c) => c.parentCode === a.code));
  const all = leaves.map((a) => {
    const o = before.get(a.code) ?? z;
    const p = during.get(a.code) ?? z;
    const open = o.debit - o.credit;
    return { ...a, open, pDebit: p.debit, pCredit: p.credit, close: open + p.debit - p.credit };
  }).filter((r) => r.open || r.pDebit || r.pCredit || r.close);
  const q = sp.q?.trim().toLowerCase();
  const loai = sp.loai && TRIAL_TYPES[sp.loai] ? sp.loai : "";
  const filtered = all.filter((r) => (!loai || r.type === loai) && (!q || r.code.includes(q) || r.name.toLowerCase().includes(q)));
  const sort = parseSort(sp, ["tk", "ten", "odn", "odc", "pn", "pc", "cdn", "cdc"]);
  const rows = sortRows(filtered, sort, {
    tk: (r) => r.code, ten: (r) => r.name, odn: (r) => Math.max(0, r.open), odc: (r) => Math.max(0, -r.open),
    pn: (r) => r.pDebit, pc: (r) => r.pCredit, cdn: (r) => Math.max(0, r.close), cdc: (r) => Math.max(0, -r.close),
  });
  return { period, all, rows, sort, q, loai };
}

/* ---------------- Tiền lương ---------------- */
export type PayrollSP = { thang?: string; xep?: string; chieu?: string };
export const PAYROLL_SORT = ["ma", "ten", "chucvu", "dinhmuc", "cong", "buoi", "luong", "tangca", "le", "phucap", "thuong", "bhxh", "thue", "tong", "ung", "thuclinh"];

export async function loadPayroll(sp: PayrollSP) {
  const periods = await db.payrollPeriod.findMany({ orderBy: { month: "desc" } });
  const period = periods.find((p) => p.month === sp.thang) ?? periods[0];
  if (!period) return null;
  const sort = parseSort(sp, PAYROLL_SORT);
  const raw = await db.payrollLine.findMany({ where: { periodId: period.id }, include: { employee: true }, orderBy: { employee: { code: "asc" } } });
  const lines = sortRows(raw, sort, {
    ma: (l) => l.employee.code, ten: (l) => l.employee.fullName, cong: (l) => Number(l.workDays), buoi: (l) => l.teachingSessions, luong: (l) => l.baseSalary,
    chucvu: (l) => l.employee.position ?? "", dinhmuc: (l) => l.salaryNorm, tangca: (l) => l.overtimePay, le: (l) => l.holidayPay, tong: (l) => grossOf(l), ung: (l) => l.advance,
    phucap: (l) => l.allowance, thuong: (l) => l.bonus, bhxh: (l) => l.insurance, thue: (l) => l.pit, thuclinh: (l) => l.netPay,
  });
  return { periods, period, lines, sort };
}
