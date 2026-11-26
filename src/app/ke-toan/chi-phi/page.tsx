import { Banknote, Plus, Receipt, ShoppingCart, Trash2, TrendingDown } from "lucide-react";
import { ActionForm, ConfirmButton, Field, Grid, ModalButton, RowMenu } from "@/components/ui/modal";
import { VoucherRowMenu } from "@/components/accounting/vouchers";
import { createPayable, deletePayable, payPayable } from "@/lib/actions/cash";
import { can } from "@/lib/auth/permissions";
import { addDays } from "@/lib/dates";
import { PageHeader } from "@/components/layout/app-shell";
import { MonthNav, StatCard, VoucherBadge, monthLabel } from "@/components/accounting/ui";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { pickMonth } from "@/lib/accounting/queries";
import { fmtDate, monthRange, todayVN, toDate, toDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { MoneyInput } from "@/components/ui/money-input";

export const metadata = { title: "Chi phí & mua hàng" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ thang?: string }> }) {
  const user = await guardPage("accounting.view");
  const post = can(user.role, "accounting.post");
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
  const [suppliers, outCats, accounts] = post ? await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.txnCategory.findMany({ where: { direction: "OUT", code: { notIn: ["CHI_LUONG", "CHI_BH", "CHI_NCC"] } }, orderBy: { order: "asc" } }),
    db.cashAccount.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]) : [[], [], []];
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
      <PageHeader title="Chi phí & mua hàng" subtitle="Tổng hợp phiếu chi, báo nợ theo khoản mục và công nợ nhà cung cấp" actions={<>
        {post && (
          <ModalButton variant="primary" label="Ghi hóa đơn mua hàng" icon={<Plus size={16} />} title="Ghi hóa đơn mua hàng trả chậm" subtitle="Ghi Nợ chi phí / Có 331, trả tiền sau">
            <ActionForm action={createPayable} submitLabel="Ghi hóa đơn">
              <Grid>
                <Field label="Nhà cung cấp">
                  <select name="supplierId" required defaultValue="" className="input"><option value="" disabled>Chọn</option>{suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                </Field>
                <Field label="Khoản mục">
                  <select name="categoryId" required defaultValue="" className="input"><option value="" disabled>Chọn</option>{outCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </Field>
              </Grid>
              <Field label="Diễn giải"><input name="description" required className="input" placeholder="VD: Mua giáo trình HSK tháng 12" /></Field>
              <Grid cols={3}>
                <Field label="Số tiền (đ)"><MoneyInput name="amount" required /></Field>
                <Field label="Ngày hóa đơn"><input type="date" name="billDate" defaultValue={today} required className="input" /></Field>
                <Field label="Hạn trả"><input type="date" name="dueDate" defaultValue={addDays(today, 30)} required className="input" /></Field>
              </Grid>
            </ActionForm>
          </ModalButton>
        )}
        <MonthNav month={month} base="/ke-toan/chi-phi" />
      </>} />
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
                <tr><th className="px-5 py-2.5">Hóa đơn</th><th className="px-3 py-2.5">Nhà cung cấp</th><th className="px-3 py-2.5 text-right">Số tiền</th><th className="px-3 py-2.5">Hạn trả</th><th className="px-5 py-2.5 text-right">Còn nợ</th>{post && <th className="w-24" />}</tr>
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
                      {post && (
                        <td className="whitespace-nowrap px-2 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1">
                            {remain > 0 && (
                              <ModalButton variant="bare" className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-semibold text-brand-600 hover:bg-brand-100" label="Trả" icon={<Banknote size={14} />}
                                title={`Trả nợ ${p.code}`} subtitle={`${p.supplier?.name} · còn nợ ${money(remain)}`} size="sm">
                                <ActionForm action={payPayable.bind(null, p.id)} submitLabel="Lập phiếu chi">
                                  <Field label="Số tiền (đ)"><MoneyInput name="amount" required defaultValue={remain} /></Field>
                                  <Grid>
                                    <Field label="Nguồn tiền">
                                      <select name="accountId" required defaultValue={accounts.find((a) => a.kind === "BANK")?.id} className="input">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                                    </Field>
                                    <Field label="Ngày trả"><input type="date" name="date" defaultValue={today} required className="input" /></Field>
                                  </Grid>
                                </ActionForm>
                              </ModalButton>
                            )}
                            <RowMenu>
                              <ConfirmButton label="Xóa hóa đơn" icon={<Trash2 size={15} />} title={`Xóa hóa đơn ${p.code}?`}
                                message="Chỉ xóa được hóa đơn chưa trả tiền (ghi nhầm). Sổ cái ghi bút toán đảo để giữ dấu vết." action={deletePayable.bind(null, p.id)} />
                            </RowMenu>
                          </span>
                        </td>
                      )}
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
              <tr><th className="px-5 py-2.5">Ngày</th><th className="px-3 py-2.5">Chứng từ</th><th className="px-3 py-2.5">Diễn giải</th><th className="px-3 py-2.5">Khoản mục</th><th className="px-3 py-2.5">Nguồn tiền</th><th className="px-5 py-2.5 text-right">Số tiền</th>{post && <th className="w-12" />}</tr>
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
                  {post && <td className="px-2 py-2.5 text-right">{VoucherRowMenu({ id: t.id, code: t.code, date: toDay(t.date), description: t.description, counterparty: t.counterparty, label: "", linked: t.paymentId ? "Học phí" : t.payrollPeriodId ? "Tiền lương" : null, in: 0, out: t.amount, balance: 0 })}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
