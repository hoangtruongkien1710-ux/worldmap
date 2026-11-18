import { db } from "@/lib/db";
import { addDays, monthOf, monthRange, todayVN, toDate, toDay } from "@/lib/dates";
import { signedFor } from "./cash";

export { signedFor };

/** Tháng đang xem từ query ?thang=yyyy-MM (mặc định tháng hiện tại). */
export function pickMonth(v?: string) {
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : monthOf(todayVN());
}

/** Số dư từng tài khoản tiền tại cuối ngày `day`. */
export async function cashBalances(day: string) {
  const accounts = await db.cashAccount.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const txns = await db.cashTxn.findMany({
    where: { voidedAt: null, date: { lte: toDate(day) } },
    select: { type: true, amount: true, accountId: true, toAccountId: true },
  });
  return accounts.map((a) => ({
    ...a,
    balance: a.openingBalance + txns.reduce((s, t) => s + signedFor(t, a.id), 0),
  }));
}

/** Sổ quỹ / sổ tiền gửi: số dư đầu kỳ, từng chứng từ với số dư lũy kế, tổng thu chi trong tháng. */
export async function cashBook(accountId: string, month: string) {
  const { from, to } = monthRange(month);
  const account = await db.cashAccount.findUniqueOrThrow({ where: { id: accountId } });
  const where = { voidedAt: null, OR: [{ accountId }, { toAccountId: accountId }] };
  const before = await db.cashTxn.findMany({ where: { ...where, date: { lt: toDate(from) } }, select: { type: true, amount: true, accountId: true, toAccountId: true } });
  const opening = account.openingBalance + before.reduce((s, t) => s + signedFor(t, accountId), 0);
  const txns = await db.cashTxn.findMany({
    where: { ...where, date: { gte: toDate(from), lte: toDate(to) } },
    include: { category: true, account: true },
    orderBy: [{ date: "asc" }, { code: "asc" }],
  });
  const accounts = await db.cashAccount.findMany();
  const nameOf = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "";
  let run = opening;
  let totalIn = 0;
  let totalOut = 0;
  const rows = txns.map((t) => {
    const v = signedFor(t, accountId);
    run += v;
    if (v > 0) totalIn += v;
    else totalOut -= v;
    const label = t.type === "TRANSFER"
      ? v > 0 ? `Nhận từ ${t.account.name}` : `Chuyển sang ${nameOf(t.toAccountId)}`
      : t.category?.name ?? "";
    return { id: t.id, code: t.code, date: toDay(t.date), description: t.description, counterparty: t.counterparty, label, in: v > 0 ? v : 0, out: v < 0 ? -v : 0, balance: run };
  });
  return { account, opening, rows, totalIn, totalOut, closing: run };
}

/** Số phát sinh Nợ/Có theo tài khoản trong khoảng ngày (dùng cho bảng cân đối, lãi lỗ). */
export async function ledgerSums(from: string | null, to: string) {
  const rows = await db.journalLine.groupBy({
    by: ["accountCode"],
    where: { entry: { date: { ...(from ? { gte: toDate(from) } : {}), lte: toDate(to) } } },
    _sum: { debit: true, credit: true },
  });
  const map = new Map<string, { debit: number; credit: number }>();
  for (const r of rows) map.set(r.accountCode, { debit: r._sum.debit ?? 0, credit: r._sum.credit ?? 0 });
  return map;
}

/** Cộng các tài khoản có mã bắt đầu bằng `prefix` (VD "642" gồm 6421, 6422). */
export function sumPrefix(map: Map<string, { debit: number; credit: number }>, prefix: string) {
  let debit = 0;
  let credit = 0;
  for (const [code, v] of map) if (code.startsWith(prefix)) { debit += v.debit; credit += v.credit; }
  return { debit, credit };
}

/** Kết quả kinh doanh tạm tính của một khoảng ngày. */
export async function profitAndLoss(from: string, to: string) {
  const m = await ledgerSums(from, to);
  const net = (p: string) => { const s = sumPrefix(m, p); return s.credit - s.debit; };
  const cost = (p: string) => { const s = sumPrefix(m, p); return s.debit - s.credit; };
  const revenue = { tuition: net("5113"), other: net("5118") + net("711") };
  const expenses = { teaching: cost("632"), marketing: cost("6421"), admin: cost("6422"), other: cost("811") };
  const totalRevenue = revenue.tuition + revenue.other;
  const totalExpense = expenses.teaching + expenses.marketing + expenses.admin + expenses.other;
  return { revenue, expenses, totalRevenue, totalExpense, profit: totalRevenue - totalExpense };
}

/** Số dư cuối ngày của tài khoản tổng hợp (Nợ − Có). */
export async function ledgerBalance(prefix: string, day: string) {
  const m = await ledgerSums(null, day);
  const s = sumPrefix(m, prefix);
  return s.debit - s.credit;
}

export const prevDay = (day: string) => addDays(day, -1);
