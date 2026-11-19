import { db } from "@/lib/db";
import { addDays, monthRange, shiftMonth, toDate, toDay } from "@/lib/dates";
import { loadInvoices } from "@/lib/tuition/summary";
import { signedFor } from "./cash";
import { ledgerBalance, profitAndLoss } from "./queries";

const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);

/* ------------------------------------------------------------------ */
/* 1. Báo cáo thu chi ngày                                             */
/* ------------------------------------------------------------------ */
export async function dailyCash(day: string) {
  const accounts = await db.cashAccount.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const all = await db.cashTxn.findMany({
    where: { voidedAt: null, date: { lte: toDate(day) } },
    select: { id: true, code: true, type: true, amount: true, accountId: true, toAccountId: true, date: true, description: true, counterparty: true, category: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { code: "asc" }],
  });
  const counts = await db.cashCount.findMany({ where: { date: toDate(day) } });
  const today = all.filter((t) => toDay(t.date) === day);
  const rows = accounts.map((a) => {
    const before = sum(all.filter((t) => toDay(t.date) < day), (t) => signedFor(t, a.id));
    const moves = today.map((t) => signedFor(t, a.id));
    const totalIn = sum(moves.filter((v) => v > 0), (v) => v);
    const totalOut = -sum(moves.filter((v) => v < 0), (v) => v);
    const opening = a.openingBalance + before;
    const closing = opening + totalIn - totalOut;
    const count = counts.find((c) => c.accountId === a.id);
    return { account: a, opening, totalIn, totalOut, closing, count: count ? { counted: count.counted, diff: count.counted - closing, note: count.note } : null };
  });
  const name = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "";
  const vouchers = today.map((t) => ({
    id: t.id, code: t.code, description: t.description, counterparty: t.counterparty,
    label: t.type === "TRANSFER" ? `${name(t.accountId)} → ${name(t.toAccountId)}` : `${t.category?.name ?? ""} · ${name(t.accountId)}`,
    in: t.type === "IN" ? t.amount : 0, out: t.type === "OUT" ? t.amount : 0, transfer: t.type === "TRANSFER" ? t.amount : 0,
  }));
  return { rows, vouchers };
}

/* ------------------------------------------------------------------ */
/* 2. Báo cáo công nợ                                                   */
/* ------------------------------------------------------------------ */
export const AGE_BUCKETS = [
  { key: "0-30", label: "Dưới 30 ngày", max: 30 },
  { key: "31-60", label: "31–60 ngày", max: 60 },
  { key: "61-90", label: "61–90 ngày", max: 90 },
  { key: "90+", label: "Trên 90 ngày", max: Infinity },
];

export async function debtReport(day: string) {
  const invoices = (await loadInvoices()).filter((i) => i.remain > 0);
  const classes = await db.class.findMany({ select: { id: true, code: true, name: true, color: true } });
  const buckets = AGE_BUCKETS.map((b) => ({ ...b, amount: 0, count: 0 }));
  const byClass = new Map<string, { remain: number; students: Set<string> }>();
  const debtors = invoices.map((i) => {
    const from = toDay(i.lockedAt ?? i.createdAt);
    const age = Math.max(0, daysBetween(from, day));
    const b = buckets.find((x) => age <= x.max)!;
    b.amount += i.remain;
    b.count += 1;
    for (const it of i.items) {
      const share = i.total ? Math.round((i.remain * it.amount) / i.total) : 0;
      const v = byClass.get(it.classId) ?? { remain: 0, students: new Set() };
      v.remain += share;
      v.students.add(i.studentId);
      byClass.set(it.classId, v);
    }
    return { id: i.id, student: i.student, classes: i.items.map((it) => it.className).join(", "), total: i.total, paid: i.paid, remain: i.remain, age, lastPaid: i.payments.at(-1)?.paidAt ?? null };
  }).sort((a, b) => b.remain - a.remain);
  const classRows = [...byClass].map(([id, v]) => ({ cls: classes.find((c) => c.id === id), remain: v.remain, students: v.students.size })).sort((a, b) => b.remain - a.remain);

  const payables = await db.payable.findMany({ include: { supplier: true }, orderBy: { dueDate: "asc" } });
  const paidBy = await db.cashTxn.groupBy({ by: ["payableId"], where: { voidedAt: null, payableId: { not: null } }, _sum: { amount: true } });
  const supplierBills = payables
    .map((p) => {
      const remain = p.amount - (paidBy.find((x) => x.payableId === p.id)?._sum.amount ?? 0);
      const dueIn = daysBetween(day, toDay(p.dueDate));
      return { ...p, remain, dueIn, state: dueIn < 0 ? "overdue" : dueIn <= 7 ? "soon" : "later" };
    })
    .filter((p) => p.remain > 0);
  const [salary, insurance, pit] = await Promise.all([ledgerBalance("334", day), ledgerBalance("3383", day), ledgerBalance("3335", day)]);
  return {
    receivable: { total: sum(debtors, (d) => d.remain), buckets, debtors, classRows },
    payable: { suppliers: supplierBills, supplierTotal: sum(supplierBills, (p) => p.remain), salary: Math.max(0, -salary), insurance: Math.max(0, -insurance), pit: Math.max(0, -pit) },
  };
}

/* ------------------------------------------------------------------ */
/* 3. Báo cáo doanh thu (theo tuần)                                    */
/* ------------------------------------------------------------------ */
async function revenueBetween(from: string, to: string) {
  const range = { gte: toDate(from), lte: toDate(to) };
  const [lines, other, payments] = await Promise.all([
    db.journalLine.findMany({ where: { accountCode: "5113", entry: { date: range } }, select: { classId: true, debit: true, credit: true } }),
    db.journalLine.findMany({ where: { accountCode: { in: ["5118", "711"] }, entry: { date: range } }, select: { accountCode: true, debit: true, credit: true } }),
    db.payment.findMany({ where: { voidedAt: null, paidAt: range }, select: { amount: true, classId: true, method: true, invoice: { select: { lockedDetail: true } } } }),
  ]);
  const recognized = new Map<string, number>();
  for (const l of lines) recognized.set(l.classId ?? "", (recognized.get(l.classId ?? "") ?? 0) + l.credit - l.debit);
  const collected = new Map<string, number>();
  for (const p of payments) {
    const cid = p.classId ?? ((p.invoice.lockedDetail ?? []) as { classId: string }[])[0]?.classId ?? "";
    collected.set(cid, (collected.get(cid) ?? 0) + p.amount);
  }
  return {
    recognized, collected,
    totalRecognized: sum([...recognized.values()], (v) => v),
    totalCollected: sum(payments, (p) => p.amount),
    transfer: sum(payments.filter((p) => p.method !== "CASH"), (p) => p.amount),
    otherIncome: sum(other, (l) => l.credit - l.debit),
  };
}

export async function revenueReport(monday: string) {
  const sunday = addDays(monday, 6);
  const [cur, prev] = await Promise.all([revenueBetween(monday, sunday), revenueBetween(addDays(monday, -7), addDays(monday, -1))]);
  // Lũy kế từ đầu tháng đến hết tuần, so với cùng kỳ tháng trước.
  const monthStart = `${sunday.slice(0, 7)}-01`;
  const prevMonthStart = `${shiftMonth(sunday.slice(0, 7), -1)}-01`;
  const span = daysBetween(monthStart, sunday);
  const prevEnd = addDays(prevMonthStart, Math.min(span, daysBetween(prevMonthStart, monthRange(shiftMonth(sunday.slice(0, 7), -1)).to)));
  const [mtd, prevMtd] = await Promise.all([revenueBetween(monthStart, sunday), revenueBetween(prevMonthStart, prevEnd)]);

  const classes = await db.class.findMany({ include: { course: { include: { program: true } }, grade: true } });
  const ids = new Set([...cur.recognized.keys(), ...cur.collected.keys(), ...prev.recognized.keys(), ...prev.collected.keys()]);
  const byClass = [...ids].map((id) => {
    const c = classes.find((x) => x.id === id);
    return {
      id, name: c?.name ?? "Không rõ lớp", color: c?.color ?? "#94a3b8", program: c?.course?.program.name ?? "Khác", grade: c?.grade?.name ?? "—",
      recognized: cur.recognized.get(id) ?? 0, collected: cur.collected.get(id) ?? 0, prevCollected: prev.collected.get(id) ?? 0,
    };
  }).filter((r) => r.recognized || r.collected || r.prevCollected).sort((a, b) => b.collected + b.recognized - (a.collected + a.recognized));
  const group = (key: "program" | "grade") => {
    const m = new Map<string, { recognized: number; collected: number }>();
    for (const r of byClass) { const v = m.get(r[key]) ?? { recognized: 0, collected: 0 }; v.recognized += r.recognized; v.collected += r.collected; m.set(r[key], v); }
    return [...m].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.collected - a.collected);
  };
  return { from: monday, to: sunday, cur, prev, mtd, prevMtd, mtdLabel: { from: monthStart, to: sunday, prevFrom: prevMonthStart, prevTo: prevEnd }, byClass, byProgram: group("program"), byGrade: group("grade") };
}

/* ------------------------------------------------------------------ */
/* 4. Báo cáo chi phí (theo tháng)                                     */
/* ------------------------------------------------------------------ */
const SETTLE = ["CHI_NCC", "CHI_LUONG", "CHI_BH"]; // trả nợ, không phải chi phí mới

async function expensesOf(month: string) {
  const { from, to } = monthRange(month);
  const range = { gte: toDate(from), lte: toDate(to) };
  const [txns, bills, payroll] = await Promise.all([
    db.cashTxn.findMany({ where: { voidedAt: null, type: "OUT", date: range, category: { code: { notIn: SETTLE } } }, include: { category: true, supplier: true } }),
    db.payable.findMany({ where: { billDate: range }, include: { category: true, supplier: true } }),
    db.journalLine.findMany({ where: { entry: { date: range, voucherType: { in: ["LUONG", "NVK"] }, sourceType: "PayrollPeriod" }, accountCode: { in: ["632", "6422"] } }, select: { debit: true } }),
  ]);
  const items = [
    ...txns.map((t) => ({ code: t.category?.code ?? "CHI_KHAC", name: t.category?.name ?? "Chi khác", amount: t.amount, date: toDay(t.date), description: t.description, who: t.supplier?.name ?? t.counterparty, ref: t.code })),
    ...bills.map((b) => ({ code: b.category?.code ?? "CHI_KHAC", name: b.category?.name ?? "Chi khác", amount: b.amount, date: toDay(b.billDate), description: b.description, who: b.supplier?.name ?? null, ref: b.code })),
  ];
  const payrollCost = sum(payroll, (l) => l.debit);
  return { items, payrollCost };
}

export async function expenseReport(month: string) {
  const [cur, prev, budgetRow] = await Promise.all([expensesOf(month), expensesOf(shiftMonth(month, -1)), db.setting.findUnique({ where: { key: "budget.monthly" } })]);
  const budget = (budgetRow?.value ?? {}) as Record<string, number>;
  const cats = new Map<string, { code: string; name: string; amount: number; prev: number; count: number }>();
  for (const [list, field] of [[cur.items, "amount"], [prev.items, "prev"]] as const) {
    for (const i of list) {
      const v = cats.get(i.code) ?? { code: i.code, name: i.name, amount: 0, prev: 0, count: 0 };
      v[field] += i.amount;
      if (field === "amount") v.count += 1;
      cats.set(i.code, v);
    }
  }
  const rows: { code: string; name: string; amount: number; prev: number; count: number; budget: number | null }[] = [...cats.values()].map((c) => ({ ...c, budget: budget[c.code] ?? null })).sort((a, b) => b.amount - a.amount);
  if (cur.payrollCost || prev.payrollCost) rows.push({ code: "LUONG", name: "Lương & bảo hiểm (theo bảng lương)", amount: cur.payrollCost, prev: prev.payrollCost, count: cur.payrollCost ? 1 : 0, budget: null });
  return {
    rows,
    total: sum(rows, (r) => r.amount), prevTotal: sum(rows, (r) => r.prev),
    budgetTotal: sum(Object.values(budget), (v) => v),
    top: [...cur.items].sort((a, b) => b.amount - a.amount).slice(0, 8),
  };
}

/* ------------------------------------------------------------------ */
/* 5. Báo cáo lương                                                     */
/* ------------------------------------------------------------------ */
export async function payrollReport(month?: string) {
  const periods = await db.payrollPeriod.findMany({ orderBy: { month: "desc" } });
  const period = periods.find((p) => p.month === month) ?? periods[0];
  if (!period) return null;
  const prevPeriod = periods.find((p) => p.month < period.month);
  const load = async (id?: string) => (id ? db.payrollLine.findMany({ where: { periodId: id }, include: { employee: true }, orderBy: { employee: { code: "asc" } } }) : []);
  const [lines, prevLines, payTxns] = await Promise.all([
    load(period.id), load(prevPeriod?.id),
    db.cashTxn.findMany({ where: { payrollPeriodId: period.id, voidedAt: null }, orderBy: { date: "asc" } }),
  ]);
  const gross = (l: (typeof lines)[number]) => l.baseSalary + l.allowance + l.bonus - l.deduction;
  const dept = (ls: typeof lines, d: string) => {
    const xs = ls.filter((l) => l.employee.department === d);
    return { count: xs.length, gross: sum(xs, gross), insurance: sum(xs, (l) => l.insurance), pit: sum(xs, (l) => l.pit), net: sum(xs, (l) => l.netPay), sessions: sum(xs, (l) => l.teachingSessions ?? 0) };
  };
  const depts = ["GIAO_VIEN", "VAN_PHONG"].map((d) => ({ key: d, label: d === "GIAO_VIEN" ? "Giáo viên" : "Văn phòng", cur: dept(lines, d), prev: dept(prevLines, d) }));
  const net = sum(lines, (l) => l.netPay);
  const paid = sum(payTxns, (t) => t.amount);
  return {
    periods: periods.map((p) => p.month), period, prevPeriod, lines, gross, depts,
    totals: { gross: sum(lines, gross), net, insurance: sum(lines, (l) => l.insurance), pit: sum(lines, (l) => l.pit), prevGross: sum(prevLines, gross) },
    paid, unpaid: Math.max(0, net - paid), payTxns,
  };
}

/* ------------------------------------------------------------------ */
/* 6. Kết quả kinh doanh                                               */
/* ------------------------------------------------------------------ */
export async function incomeReport(month: string, firstMonth = "2026-09") {
  const year = month.slice(0, 4);
  const range = (m: string) => monthRange(m);
  const months: string[] = [];
  for (let m = firstMonth > `${year}-01` ? firstMonth : `${year}-01`; m <= month; m = shiftMonth(m, 1)) months.push(m);
  const series = await Promise.all(months.map(async (m) => ({ month: m, ...(await profitAndLoss(range(m).from, range(m).to)) })));
  const cur = series.at(-1) ?? { month, ...(await profitAndLoss(range(month).from, range(month).to)) };
  const prev = series.at(-2) ?? null;
  const ytd = await profitAndLoss(`${year}-01-01`, range(month).to);
  return { cur, prev, ytd, series };
}
