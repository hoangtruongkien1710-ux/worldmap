import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, HandCoins, Landmark, Receipt, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard, VoucherBadge } from "@/components/accounting/ui";
import { PeriodBar, qs } from "@/components/accounting/period-bar";
import { pickPeriod, type PeriodSP } from "@/lib/accounting/period";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { cashBalances, ledgerBalance, profitAndLoss } from "@/lib/accounting/queries";
import { fmtDate, monthOf, monthRange, shiftMonth, todayVN, toDate, toDay } from "@/lib/dates";
import { money, shortMoney } from "@/lib/money";

export const metadata = { title: "Tổng quan kế toán" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<PeriodSP> }) {
  await guardPage("accounting.view");
  const sp = await searchParams;
  const period = pickPeriod(sp);
  const today = todayVN();
  const { from, to } = period;
  const asOf = to < today ? to : today;
  const month = monthOf(asOf < from ? from : asOf);

  const months = [shiftMonth(month, -2), shiftMonth(month, -1), month];
  const [balances, receivable, payable, pl, flows, cur, recent] = await Promise.all([
    cashBalances(asOf),
    ledgerBalance("131", asOf),
    ledgerBalance("331", asOf).then((v) => Math.max(0, -v)),
    profitAndLoss(from, to),
    Promise.all(months.map(async (m) => {
      const r = monthRange(m);
      const g = await db.cashTxn.groupBy({ by: ["type"], where: { voidedAt: null, type: { in: ["IN", "OUT"] }, date: { gte: toDate(r.from), lte: toDate(r.to) } }, _sum: { amount: true } });
      const v = (t: string) => g.find((x) => x.type === t)?._sum.amount ?? 0;
      return { month: m, in: v("IN"), out: v("OUT") };
    })),
    db.cashTxn.groupBy({ by: ["type"], where: { voidedAt: null, type: { in: ["IN", "OUT"] }, date: { gte: toDate(from), lte: toDate(to) } }, _sum: { amount: true } })
      .then((g) => ({ in: g.find((x) => x.type === "IN")?._sum.amount ?? 0, out: g.find((x) => x.type === "OUT")?._sum.amount ?? 0 })),
    db.cashTxn.findMany({ where: { voidedAt: null, date: { gte: toDate(from), lte: toDate(asOf < from ? from : asOf) } }, include: { account: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 8 }),
  ]);
  const cash = balances.filter((b) => b.kind === "CASH").reduce((s, b) => s + b.balance, 0);
  const bank = balances.filter((b) => b.kind === "BANK").reduce((s, b) => s + b.balance, 0);
  const max = Math.max(1, ...flows.flatMap((f) => [f.in, f.out]));

  return (
    <>
      <PageHeader title="Tổng quan kế toán" subtitle={`Số liệu đến ngày ${fmtDate(asOf)} · lãi lỗ là tạm tính`} />
      <PeriodBar base="/ke-toan" period={period} params={sp} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="emerald" icon={<Wallet size={20} />} label="Tiền mặt tại quỹ" value={money(cash)} />
        <StatCard tone="blue" icon={<Landmark size={20} />} label="Tiền gửi ngân hàng" value={money(bank)} hint={balances.filter((b) => b.kind === "BANK").map((b) => `${b.code} ${shortMoney(b.balance)}`).join(" · ")} />
        <StatCard tone="rose" icon={<HandCoins size={20} />} label="Học phí còn phải thu" value={money(receivable)} hint={<Link href="/ke-toan/hoc-phi?tt=con-no" className="underline">Xem học viên còn nợ</Link>} />
        <StatCard tone="orange" icon={<Receipt size={20} />} label="Phải trả nhà cung cấp" value={money(payable)} hint={<Link href="/ke-toan/chi-phi" className="underline">Xem công nợ</Link>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <h2 className="mb-1 text-lg font-bold">Dòng tiền thu chi</h2>
          <p className="mb-4 text-xs text-slate-500">Không tính chuyển tiền nội bộ giữa quỹ và ngân hàng</p>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 p-3"><div className="flex items-center gap-1 text-xs font-medium text-emerald-700"><ArrowDownLeft size={14} /> Thu · {period.label}</div><div className="text-xl font-extrabold text-emerald-700">{money(cur.in)}</div></div>
            <div className="rounded-xl bg-rose-50 p-3"><div className="flex items-center gap-1 text-xs font-medium text-rose-700"><ArrowUpRight size={14} /> Chi · {period.label}</div><div className="text-xl font-extrabold text-rose-700">{money(cur.out)}</div></div>
          </div>
          <div className="space-y-3">
            {flows.filter((f) => f.in || f.out).map((f) => (
              <div key={f.month} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 text-xs">
                <span className="font-semibold text-slate-600">{f.month.slice(5)}/{f.month.slice(0, 4)}</span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><div className="h-3 rounded-r bg-emerald-500" style={{ width: `${(f.in / max) * 80}%` }} /><span className="text-slate-600">{shortMoney(f.in)}</span></div>
                  <div className="flex items-center gap-2"><div className="h-3 rounded-r bg-rose-400" style={{ width: `${(f.out / max) * 80}%` }} /><span className="text-slate-600">{shortMoney(f.out)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">Lãi lỗ tạm tính · {period.label}</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Doanh thu học phí" value={pl.revenue.tuition} />
            <Row label="Doanh thu khác (giáo trình, thi thử)" value={pl.revenue.other} />
            <Row label="Tổng doanh thu" value={pl.totalRevenue} bold />
            <div className="my-2 border-t border-dashed border-slate-200" />
            <Row label="Lương giáo viên, giáo trình (632)" value={-pl.expenses.teaching} />
            <Row label="Marketing (6421)" value={-pl.expenses.marketing} />
            <Row label="Quản lý: thuê nhà, điện nước, lương VP (6422)" value={-pl.expenses.admin} />
            <Row label="Chi phí khác (811)" value={-pl.expenses.other} />
            <div className="my-2 border-t border-slate-200" />
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="font-bold">Lợi nhuận tạm tính</dt>
              <dd className={`text-lg font-extrabold ${pl.profit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{money(pl.profit)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">Doanh thu ghi nhận khi khai giảng. Lương tháng chỉ có sau khi nhập bảng lương.</p>
        </section>
      </div>

      <section className="card mt-6 p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Chứng từ gần đây <span className="text-xs font-medium text-slate-400">(mới nhất trước)</span></h2><Link href={`/ke-toan/quy${qs({ ky: "tuychon", tu: from, den: to })}`} className="text-sm font-semibold text-acc-700 hover:underline">Xem sổ quỹ →</Link></div>
        <div className="divide-y divide-slate-100">
          {recent.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <span className="w-20 shrink-0 text-slate-500">{fmtDate(t.date)}</span>
              <Link href={`${t.account.kind === "BANK" ? `/ke-toan/ngan-hang?tk=${t.account.code}&` : "/ke-toan/quy?"}ky=tuychon&tu=${toDay(t.date)}&den=${toDay(t.date)}`} className="font-semibold text-acc-700 hover:underline">{t.code}</Link>
              <VoucherBadge code={t.code} />
              <span className="min-w-0 flex-1 truncate">{t.description}</span>
              <span className="text-xs text-slate-500">{t.account.code}</span>
              <span className={`w-32 text-right font-semibold ${t.type === "IN" ? "text-emerald-700" : t.type === "OUT" ? "text-rose-600" : "text-violet-700"}`}>
                {t.type === "OUT" ? "−" : t.type === "IN" ? "+" : ""}{money(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={bold ? "font-semibold" : "text-slate-600"}>{label}</dt>
      <dd className={`whitespace-nowrap ${bold ? "font-bold" : ""} ${value < 0 ? "text-rose-600" : ""}`}>{money(value)}</dd>
    </div>
  );
}
