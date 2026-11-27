import Link from "next/link";
import { Banknote, Pencil, Plus, Receipt, ShoppingCart, Trash2, TrendingDown } from "lucide-react";
import { ActionForm, ConfirmButton, Field, Grid, ModalButton, RowMenu } from "@/components/ui/modal";
import { VoucherRowMenu, loadVoucherLookups } from "@/components/accounting/vouchers";
import { createPayable, deletePayable, payPayable, updatePayable } from "@/lib/actions/cash";
import { can } from "@/lib/auth/permissions";
import { addDays } from "@/lib/dates";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard, VoucherBadge } from "@/components/accounting/ui";
import { PeriodBar, SearchForm, qs } from "@/components/accounting/period-bar";
import { SortTh } from "@/components/ui/sort-th";
import { pickPeriod, type PeriodSP } from "@/lib/accounting/period";
import { parseSort, sortRows } from "@/lib/sort";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { fmtDate, todayVN, toDate, toDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { MoneyInput } from "@/components/ui/money-input";

export const metadata = { title: "Chi phí & mua hàng" };
export const dynamic = "force-dynamic";

type SP = PeriodSP & { q?: string; tt?: string; xep?: string; chieu?: string; xep2?: string; chieu2?: string };
const BASE = "/ke-toan/chi-phi";

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await guardPage("accounting.view");
  const post = can(user.role, "accounting.post");
  const sp = await searchParams;
  const period = pickPeriod(sp);
  const { from, to } = period;
  const today = todayVN();
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
  const [suppliers, outCats, accounts, lookups] = post ? await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.txnCategory.findMany({ where: { direction: "OUT", code: { notIn: ["CHI_LUONG", "CHI_BH", "CHI_NCC"] } }, orderBy: { order: "asc" } }),
    db.cashAccount.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    loadVoucherLookups(),
  ]) : [[], [], [], null];
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
  const bth = (col: string, label: string, align?: "right") => <SortTh col={col} label={label} base={BASE} params={sp} sort={billSort} align={align} className="px-3 py-2.5" />;
  const vth = (col: string, label: string, align?: "right") => <SortTh col={col} label={label} base={BASE} params={sp} sort={vSort} keys={["xep2", "chieu2"]} align={align} className="px-3 py-2.5" />;

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
      </>} />
      <PeriodBar base={BASE} period={period} params={sp} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard tone="rose" icon={<TrendingDown size={20} />} label="Tổng chi trong kỳ" value={money(total)} hint={`${txns.length} chứng từ`} />
        <StatCard tone="orange" icon={<ShoppingCart size={20} />} label="Hóa đơn mua hàng trong kỳ" value={inPeriod.length} hint={money(inPeriod.reduce((x, p) => x + p.amount, 0))} />
        <StatCard tone="amber" icon={<Receipt size={20} />} label="Còn nợ nhà cung cấp" value={money(owing)} />
      </div>

      <div className="grid gap-6">
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-bold">Chi theo khoản mục</h2>
          {cats.length === 0 && <p className="text-sm text-slate-500">Chưa có khoản chi trong kỳ.</p>}
          <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            {cats.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-sm"><span>{c.name} <span className="text-xs text-slate-400">({c.count})</span></span><b>{money(c.amount)}</b></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-400" style={{ width: `${(c.amount / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
            <h2 className="text-lg font-bold">Hóa đơn mua hàng & công nợ NCC</h2>
            <SearchForm base={BASE} params={sp} placeholder="Số HĐ, diễn giải, NCC" />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 px-5">
            {[["", "Tất cả"], ["con-no", "Còn nợ"], ["da-tra", "Đã trả"]].map(([k, l]) => (
              <Link key={k} href={`${BASE}${qs(sp, { tt: k || undefined })}`} scroll={false}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${(sp.tt ?? "") === k ? "bg-acc-600 text-white" : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"}`}>{l}</Link>
            ))}
          </div>
          <div className="mt-3 max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs">
                <tr className="[&>th]:border-b [&>th]:border-slate-200">{bth("hd", "Hóa đơn")}{bth("ncc", "Nhà cung cấp")}{bth("tien", "Số tiền", "right")}{bth("han", "Hạn trả")}{bth("conlai", "Còn nợ", "right")}{post && <th />}</tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-slate-50/50 [&>tr>td]:border-b [&>tr>td]:border-slate-100">
                {billRows.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">Không có hóa đơn mua hàng trong kỳ này.</td></tr>}
                {billRows.map((p) => {
                  const remain = p.remain;
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
                              <ModalButton variant="menu" label="Sửa hóa đơn" icon={<Pencil size={15} />} title={`Sửa ${p.code}`} subtitle={p.paidAmount > 0 ? "Đã trả một phần: chỉ sửa diễn giải, hạn trả, số tiền" : "Bút toán sẽ được ghi lại cho khớp"}>
                                <ActionForm action={updatePayable.bind(null, p.id)}>
                                  <Grid>
                                    <Field label="Nhà cung cấp">
                                      <select name="supplierId" required defaultValue={p.supplierId ?? ""} disabled={p.paidAmount > 0} className="input">{suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                                    </Field>
                                    <Field label="Khoản mục">
                                      <select name="categoryId" required defaultValue={p.categoryId ?? ""} disabled={p.paidAmount > 0} className="input">{outCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                    </Field>
                                  </Grid>
                                  <Field label="Diễn giải"><input name="description" required defaultValue={p.description} className="input" /></Field>
                                  <Grid cols={3}>
                                    <Field label="Số tiền (đ)" hint={p.paidAmount > 0 ? `Đã trả ${money(p.paidAmount)}` : undefined}><MoneyInput name="amount" required defaultValue={p.amount} /></Field>
                                    <Field label="Ngày hóa đơn"><input type="date" name="billDate" defaultValue={toDay(p.billDate)} required disabled={p.paidAmount > 0} className="input" /></Field>
                                    <Field label="Hạn trả"><input type="date" name="dueDate" defaultValue={toDay(p.dueDate)} required className="input" /></Field>
                                  </Grid>
                                </ActionForm>
                              </ModalButton>
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <h2 className="text-lg font-bold">Chứng từ chi trong kỳ <span className="text-sm font-medium text-slate-400">({txns.length})</span></h2>
          <Link href={`/ke-toan/quy${qs({ ky: period.key, thang: period.month, tu: period.from, den: period.to })}`} className="text-sm font-semibold text-acc-700 hover:underline">Xem trong sổ quỹ →</Link>
        </div>
        <div className="mt-3 max-h-[60vh] overflow-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs">
              <tr className="[&>th]:border-b [&>th]:border-slate-200">{vth("ngay", "Ngày")}{vth("so", "Chứng từ")}{vth("dg", "Diễn giải")}{vth("km", "Khoản mục")}{vth("nguon", "Nguồn tiền")}{vth("tien", "Số tiền", "right")}{post && <th className="w-12" />}</tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-slate-50/50 [&>tr>td]:border-b [&>tr>td]:border-slate-100">
              {vRows.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">Chưa có chứng từ chi trong kỳ.</td></tr>}
              {vRows.map((t) => (
                <tr key={t.id} className="hover:bg-acc-50/40">
                  <td className="whitespace-nowrap px-5 py-2.5 text-slate-600">{fmtDate(t.date)}</td>
                  <td className="px-3 py-2.5"><div className="font-semibold">{t.code}</div><VoucherBadge code={t.code} /></td>
                  <td className="px-3 py-2.5">{t.description}<div className="text-xs text-slate-500">{t.supplier?.name ?? t.counterparty}</div></td>
                  <td className="px-3 py-2.5 text-slate-600">{t.category?.name}</td>
                  <td className="px-3 py-2.5 text-slate-600">{t.account.code}</td>
                  <td className="whitespace-nowrap bg-rose-50/30 px-5 py-2.5 text-right font-semibold tabular-nums text-rose-600">{money(t.amount)}</td>
                  {post && lookups && (
                    <td className="px-2 py-2.5 text-right">
                      <VoucherRowMenu {...lookups} r={{ id: t.id, code: t.code, date: toDay(t.date), description: t.description, counterparty: t.counterparty, label: t.category?.name ?? "",
                        linked: t.paymentId ? "Học phí" : t.payrollPeriodId ? "Tiền lương" : t.payableId ? "Mua hàng" : null,
                        link: t.payableId ? { href: `${BASE}?ky=nam&q=${t.code}`, label: "" } : null, kind: t.type === "OUT" ? "OUT" : "IN", categoryId: t.categoryId, supplierId: t.supplierId, in: 0, out: t.amount, balance: 0 }} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
