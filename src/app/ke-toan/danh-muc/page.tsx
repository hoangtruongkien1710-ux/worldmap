import { Landmark, Pencil, Plus, Tags, Trash2, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { ActionForm, ConfirmButton, Field, Grid, ModalButton, RowMenu } from "@/components/ui/modal";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { CHART_OF_ACCOUNTS } from "@/lib/accounting/posting";
import { cashBalances } from "@/lib/accounting/queries";
import { todayVN } from "@/lib/dates";
import { money } from "@/lib/money";
import { deleteCategory, deleteSupplier, saveCashAccount, saveCategory, saveSupplier } from "@/lib/actions/cash";

export const metadata = { title: "Danh mục" };
export const dynamic = "force-dynamic";

const LEAF = CHART_OF_ACCOUNTS.filter((a) => !CHART_OF_ACCOUNTS.some((b) => b.parentCode === a.code) && !["911", "421"].includes(a.code));

export default async function Page() {
  const user = await guardPage("accounting.view");
  const post = can(user.role, "accounting.post");
  const [accounts, cats, suppliers, balances] = await Promise.all([
    db.cashAccount.findMany({ orderBy: { code: "asc" } }),
    db.txnCategory.findMany({ include: { _count: { select: { txns: true } } }, orderBy: [{ direction: "asc" }, { order: "asc" }, { id: "asc" }] }),
    db.supplier.findMany({ include: { _count: { select: { txns: true, payables: true } } }, orderBy: { name: "asc" } }),
    cashBalances(todayVN()),
  ]);
  const bal = (id: string) => (balances as { id: string; balance: number }[]).find((b) => b.id === id)?.balance;
  const accName = (c: string | null) => (c ? `${c} · ${CHART_OF_ACCOUNTS.find((a) => a.code === c)?.name ?? ""}` : "—");

  return (
    <>
      <PageHeader title="Danh mục" subtitle="Quỹ và tài khoản ngân hàng, khoản mục thu chi, nhà cung cấp" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section icon={<Landmark size={18} />} title="Quỹ & tài khoản ngân hàng" action={post && (
          <ModalButton variant="bare" className={ADD} label="Thêm" icon={<Plus size={15} />} title="Thêm quỹ / tài khoản ngân hàng">
            <ActionForm action={saveCashAccount.bind(null, null)}><AccountFields /></ActionForm>
          </ModalButton>
        )}>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <tr key={a.id} className={a.active ? "" : "opacity-50"}>
                  <td className="py-2.5"><div className="font-semibold">{a.name}</div><div className="text-xs text-slate-500">{a.code} · TK {a.ledgerCode}{a.accountNo ? ` · STK ${a.accountNo}` : ""}{a.active ? "" : " · ngừng dùng"}</div></td>
                  <td className="py-2.5 text-right font-semibold">{bal(a.id) !== undefined ? money(bal(a.id)!) : ""}</td>
                  {post && (
                    <td className="w-10 py-2.5 text-right">
                      <ModalButton variant="bare" className={ICON} label={<Pencil size={14} />} title={`Sửa ${a.name}`}>
                        <ActionForm action={saveCashAccount.bind(null, a.id)}><AccountFields a={a} /></ActionForm>
                      </ModalButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section icon={<Truck size={18} />} title="Nhà cung cấp" action={post && (
          <ModalButton variant="bare" className={ADD} label="Thêm" icon={<Plus size={15} />} title="Thêm nhà cung cấp">
            <ActionForm action={saveSupplier.bind(null, null)}><SupplierFields /></ActionForm>
          </ModalButton>
        )}>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5"><div className="font-semibold">{s.name}</div><div className="text-xs text-slate-500">{[s.code, s.phone, s.taxCode && `MST ${s.taxCode}`].filter(Boolean).join(" · ")}</div></td>
                  <td className="py-2.5 text-right text-xs text-slate-500">{s._count.txns + s._count.payables} chứng từ</td>
                  {post && (
                    <td className="w-10 py-2.5 text-right">
                      <RowMenu>
                        <ModalButton variant="menu" label="Sửa" icon={<Pencil size={15} />} title={`Sửa ${s.name}`}><ActionForm action={saveSupplier.bind(null, s.id)}><SupplierFields s={s} /></ActionForm></ModalButton>
                        <ConfirmButton label="Xóa" icon={<Trash2 size={15} />} title={`Xóa ${s.name}?`} message="Chỉ xóa được nhà cung cấp chưa có chứng từ." action={deleteSupplier.bind(null, s.id)} />
                      </RowMenu>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section icon={<Tags size={18} />} title="Khoản mục thu chi" className="xl:col-span-2" action={post && (
          <ModalButton variant="bare" className={ADD} label="Thêm" icon={<Plus size={15} />} title="Thêm khoản mục">
            <ActionForm action={saveCategory.bind(null, null)}><CategoryFields /></ActionForm>
          </ModalButton>
        )}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-2">Khoản mục</th><th>Loại</th><th>Hạch toán</th><th className="text-right">Đã dùng</th>{post && <th />}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {cats.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5"><div className="font-semibold">{c.name}</div><div className="text-xs text-slate-500">{c.code}</div></td>
                    <td><span className={`badge ${c.direction === "IN" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{c.direction === "IN" ? "Thu" : "Chi"}</span></td>
                    <td className="text-slate-600">{c.direction === "IN" ? `Có ${accName(c.creditAccount)}` : `Nợ ${accName(c.debitAccount)}`}</td>
                    <td className="text-right text-slate-500">{c._count.txns}</td>
                    {post && (
                      <td className="w-10 text-right">
                        {c.code !== "THU_HP" && (
                          <RowMenu>
                            <ModalButton variant="menu" label="Sửa" icon={<Pencil size={15} />} title={`Sửa ${c.name}`}><ActionForm action={saveCategory.bind(null, c.id)}><CategoryFields c={c} /></ActionForm></ModalButton>
                            <ConfirmButton label="Xóa" icon={<Trash2 size={15} />} title={`Xóa ${c.name}?`} message="Chỉ xóa được khoản mục chưa dùng." action={deleteCategory.bind(null, c.id)} />
                          </RowMenu>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}

const ADD = "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-brand-600 hover:bg-brand-50";
const ICON = "rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700";

function Section({ icon, title, action, className, children }: { icon: React.ReactNode; title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`card p-5 ${className ?? ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">{icon}</span>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function AccountFields({ a }: { a?: { code: string; name: string; kind: string; bankName: string | null; accountNo: string | null; active: boolean } }) {
  return (
    <>
      <Grid cols={3}>
        <Field label="Loại">
          <select name="kind" defaultValue={a?.kind ?? "BANK"} disabled={!!a} className="input"><option value="CASH">Quỹ tiền mặt</option><option value="BANK">Ngân hàng</option></select>
        </Field>
        <Field label="Mã" hint={a ? "Không đổi được" : "VD: BIDV"}><input name="code" defaultValue={a?.code} disabled={!!a} required={!a} className="input uppercase" /></Field>
        <Field label="Tên hiển thị"><input name="name" defaultValue={a?.name} required className="input" /></Field>
      </Grid>
      <Grid>
        <Field label="Ngân hàng"><input name="bankName" defaultValue={a?.bankName ?? ""} className="input" /></Field>
        <Field label="Số tài khoản"><input name="accountNo" defaultValue={a?.accountNo ?? ""} className="input" /></Field>
      </Grid>
      {a ? (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={a.active} className="h-4 w-4" /> Đang dùng</label>
      ) : (
        <Grid>
          <Field label="Số dư đầu (đ)"><input name="openingBalance" inputMode="numeric" defaultValue="0" className="input" /></Field>
          <Field label="Tính từ ngày"><input type="date" name="openingDate" defaultValue={todayVN()} required className="input" /></Field>
        </Grid>
      )}
    </>
  );
}

function SupplierFields({ s }: { s?: { code: string; name: string; phone: string | null; taxCode: string | null; note: string | null } }) {
  return (
    <>
      <Grid>
        <Field label="Mã" hint={s ? "Không đổi được" : "VD: NCC-FAHASA"}><input name="code" defaultValue={s?.code} disabled={!!s} required={!s} className="input uppercase" /></Field>
        <Field label="Tên"><input name="name" defaultValue={s?.name} required className="input" /></Field>
      </Grid>
      <Grid>
        <Field label="Điện thoại"><input name="phone" defaultValue={s?.phone ?? ""} className="input" /></Field>
        <Field label="Mã số thuế"><input name="taxCode" defaultValue={s?.taxCode ?? ""} className="input" /></Field>
      </Grid>
      <Field label="Ghi chú"><input name="note" defaultValue={s?.note ?? ""} className="input" /></Field>
    </>
  );
}

function CategoryFields({ c }: { c?: { code: string; name: string; direction: string; debitAccount: string | null; creditAccount: string | null } }) {
  return (
    <>
      <Grid cols={3}>
        <Field label="Loại"><select name="direction" defaultValue={c?.direction ?? "OUT"} className="input"><option value="IN">Thu</option><option value="OUT">Chi</option></select></Field>
        <Field label="Mã" hint={c ? "Không đổi được" : "VD: CHI_BAO"}><input name="code" defaultValue={c?.code} disabled={!!c} required={!c} className="input uppercase" /></Field>
        <Field label="Tên"><input name="name" defaultValue={c?.name} required className="input" /></Field>
      </Grid>
      <Field label="Tài khoản hạch toán" hint="Thu: ghi Có tài khoản này · Chi: ghi Nợ tài khoản này">
        <select name="ledger" defaultValue={c?.debitAccount ?? c?.creditAccount ?? ""} required className="input">
          <option value="" disabled>Chọn tài khoản</option>
          {LEAF.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
        </select>
      </Field>
    </>
  );
}
