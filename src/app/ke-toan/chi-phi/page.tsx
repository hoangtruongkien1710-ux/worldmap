import { Receipt, ShoppingCart, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { MonthNav, StatCard, VoucherBadge, monthLabel } from "@/components/accounting/ui";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { pickMonth } from "@/lib/accounting/queries";
import { fmtDate, monthRange, todayVN, toDate, toDay } from "@/lib/dates";
import { money } from "@/lib/money";

export const metadata = { title: "Chi phí & mua hàng" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ thang?: string }> }) {
  await guardPage("accounting.view");
  const month = pickMonth((await searchParams).thang);
  const { from, to } = monthRange(month);
  const today = todayVN();
  const [txns, payables, paidByPayable] = await Promise.all([
    db.cashTxn.findMany({
      where: { voidedAt: null, type: "OUT", date: { gte: toDate(from), lte: toDate(to) } },
      include: { category: true, account: true, supplier: true },
      orderBy: [{ date: "asc" }, { code: "asc" }],
    }),
    db.payable.findMany({ include: { supplier: true }, orderBy: { billDate: "desc" } }),
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

  return (
    <>
      <PageHeader title="Chi phí & mua hàng" subtitle="Tổng hợp phiếu chi, báo nợ theo khoản mục và công nợ nhà cung cấp" actions={<MonthNav month={month} base="/ke-toan/chi-phi" />} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard tone="rose" icon={<TrendingDown size={20} />} label={`Tổng chi ${monthLabel(month).toLowerCase()}`} value={money(total)} hint={`${txns.length} chứng từ`} />
        <StatCard tone="orange" icon={<ShoppingCart size={20} />} label="Hóa đơn mua hàng" value={payables.length} hint="Giáo trình mua trả chậm" />
        <StatCard tone="amber" icon={<Receipt size={20} />} label="Còn nợ nhà cung cấp" value={money(owing)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">Chi theo khoản mục</h2>
          {cats.length === 0 && <p className="text-sm text-slate-500">Chưa có khoản chi trong tháng.</p>}
          <div className="space-y-3">
            {cats.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-sm"><span>{c.name} <span className="text-xs text-slate-400">({c.count})</span></span><b>{money(c.amount)}</b></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-400" style={{ width: `${(c.amount / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="card overflow-hidden lg:col-span-3">
          <h2 className="px-5 pt-5 text-lg font-bold">Công nợ nhà cung cấp</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-2.5">Hóa đơn</th><th className="px-3 py-2.5">Nhà cung cấp</th><th className="px-3 py-2.5 text-right">Số tiền</th><th className="px-3 py-2.5">Hạn trả</th><th className="px-5 py-2.5 text-right">Còn nợ</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payables.map((p) => {
                  const remain = p.amount - paid(p.id);
                  const overdue = remain > 0 && toDay(p.dueDate) < today;
                  return (
                    <tr key={p.id}>
                      <td className="px-5 py-2.5"><div className="font-semibold">{p.code}</div><div className="text-xs text-slate-500">{p.description} · {fmtDate(p.billDate)}</div></td>
                      <td className="px-3 py-2.5">{p.supplier?.name}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(p.amount)}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 ${overdue ? "font-semibold text-rose-600" : "text-slate-600"}`}>{fmtDate(p.dueDate)}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right">{remain > 0 ? <b className="text-rose-600">{money(remain)}</b> : <span className="badge bg-green-50 text-green-700">Đã trả</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card mt-6 overflow-hidden">
        <h2 className="px-5 pt-5 text-lg font-bold">Chứng từ chi trong tháng</h2>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Ngày</th><th className="px-3 py-2.5">Chứng từ</th><th className="px-3 py-2.5">Diễn giải</th><th className="px-3 py-2.5">Khoản mục</th><th className="px-3 py-2.5">Nguồn tiền</th><th className="px-5 py-2.5 text-right">Số tiền</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txns.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap px-5 py-2.5 text-slate-600">{fmtDate(t.date)}</td>
                  <td className="px-3 py-2.5"><div className="font-semibold">{t.code}</div><VoucherBadge code={t.code} /></td>
                  <td className="px-3 py-2.5">{t.description}<div className="text-xs text-slate-500">{t.supplier?.name ?? t.counterparty}</div></td>
                  <td className="px-3 py-2.5 text-slate-600">{t.category?.name}</td>
                  <td className="px-3 py-2.5 text-slate-600">{t.account.code}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right font-semibold text-rose-600">{money(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
