import Link from "next/link";
import { ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, Pencil, XCircle } from "lucide-react";
import { ActionForm, ConfirmButton, Field, Grid, ModalButton, RowMenu } from "@/components/ui/modal";
import { db } from "@/lib/db";
import { todayVN } from "@/lib/dates";
import { createTransfer, createVoucher, updateVoucher, voidVoucher } from "@/lib/actions/cash";
import type { BookRow } from "./ui";
import { MoneyInput } from "@/components/ui/money-input";

type Account = { id: string; name: string; kind: "CASH" | "BANK" };

/** Nút lập phiếu thu / chi / chuyển tiền cho một quỹ hoặc tài khoản ngân hàng. */
export async function VoucherButtons({ account }: { account: Account }) {
  const [categories, suppliers, accounts] = await Promise.all([
    db.txnCategory.findMany({ where: { code: { not: "THU_HP" } }, orderBy: [{ direction: "asc" }, { order: "asc" }, { id: "asc" }] }),
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.cashAccount.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);
  const bank = account.kind === "BANK";
  const form = (type: "IN" | "OUT") => (
    <ActionForm action={createVoucher.bind(null, account.id, type)} submitLabel="Lập phiếu">
      <Grid>
        <Field label="Ngày chứng từ"><input type="date" name="date" defaultValue={todayVN()} required className="input" /></Field>
        <Field label="Số tiền (đ)"><MoneyInput name="amount" required placeholder="VD: 1.500.000" /></Field>
      </Grid>
      <Field label="Khoản mục">
        <select name="categoryId" required defaultValue="" className="input">
          <option value="" disabled>Chọn khoản mục</option>
          {categories.filter((c) => c.direction === type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Diễn giải"><input name="description" required className="input" placeholder={type === "IN" ? "VD: Thu tiền giáo trình HSK 1" : "VD: Tiền điện tháng 11"} /></Field>
      <Grid>
        <Field label={type === "IN" ? "Người nộp" : "Người nhận"}><input name="counterparty" className="input" /></Field>
        {type === "OUT" && (
          <Field label="Nhà cung cấp" hint="Chọn khi khoản mục là “Trả nhà cung cấp”">
            <select name="supplierId" defaultValue="" className="input">
              <option value="">—</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
      </Grid>
      {type === "IN" && <p className="text-xs text-slate-500">Thu học phí hãy làm ở tab Học phí của từng lớp để gắn đúng học viên.</p>}
    </ActionForm>
  );
  return (
    <>
      <ModalButton variant="primary" label={bank ? "Báo có" : "Phiếu thu"} icon={<ArrowDownCircle size={16} />} title={bank ? "Lập giấy báo có" : "Lập phiếu thu"} subtitle={account.name}>{form("IN")}</ModalButton>
      <ModalButton label={bank ? "Báo nợ" : "Phiếu chi"} icon={<ArrowUpCircle size={16} />} title={bank ? "Lập giấy báo nợ" : "Lập phiếu chi"} subtitle={account.name}>{form("OUT")}</ModalButton>
      <ModalButton label="Chuyển tiền" icon={<ArrowLeftRight size={16} />} title="Chuyển tiền nội bộ" subtitle={`Từ ${account.name}`}>
        <ActionForm action={createTransfer.bind(null, account.id)} submitLabel="Lập chứng từ">
          <Field label="Chuyển sang">
            <select name="toAccountId" required defaultValue="" className="input">
              <option value="" disabled>Chọn tài khoản nhận</option>
              {accounts.filter((a) => a.id !== account.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Grid>
            <Field label="Ngày"><input type="date" name="date" defaultValue={todayVN()} required className="input" /></Field>
            <Field label="Số tiền (đ)"><MoneyInput name="amount" required /></Field>
          </Grid>
          <Field label="Diễn giải"><input name="description" required className="input" defaultValue={bank ? "Rút tiền gửi về quỹ" : "Nộp tiền mặt vào tài khoản"} /></Field>
        </ActionForm>
      </ModalButton>
    </>
  );
}

type Cat = { id: number; name: string; direction: string };
type Sup = { id: string; name: string };

/** Danh sách khoản mục / nhà cung cấp cho form sửa chứng từ (tải một lần cho cả bảng). */
export async function loadVoucherLookups() {
  const [cats, suppliers] = await Promise.all([
    db.txnCategory.findMany({ where: { code: { not: "THU_HP" } }, orderBy: [{ direction: "asc" }, { order: "asc" }, { id: "asc" }] }),
    db.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { cats, suppliers };
}

/** Menu ⋮ trên mỗi dòng sổ quỹ / sổ ngân hàng: sửa, hủy. */
export function VoucherRowMenu({ r, cats, suppliers }: { r: BookRow; cats: Cat[]; suppliers: Sup[] }) {
  const amount = r.in || r.out;
  return (
    <RowMenu>
      {r.linked ? (
        <div className="px-3 py-2 text-xs text-slate-500">Phiếu sinh từ {r.linked}. {r.link && <Link href={r.link.href} className="font-semibold text-acc-700 underline">{r.link.label}</Link>}</div>
      ) : (
        <>
          <ModalButton variant="menu" label="Sửa chứng từ" icon={<Pencil size={15} />} title={`Sửa ${r.code}`} subtitle="Bút toán sẽ được ghi lại cho khớp">
            <ActionForm action={updateVoucher.bind(null, r.id)}>
              <Grid>
                <Field label="Ngày chứng từ"><input type="date" name="date" defaultValue={r.date} required className="input" /></Field>
                <Field label="Số tiền (đ)"><MoneyInput name="amount" defaultValue={amount} required /></Field>
              </Grid>
              {r.kind !== "TRANSFER" && (
                <Field label="Khoản mục">
                  <select name="categoryId" required defaultValue={r.categoryId ?? ""} className="input">
                    {cats.filter((c) => c.direction === r.kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Diễn giải"><input name="description" required defaultValue={r.description} className="input" /></Field>
              {r.kind !== "TRANSFER" && (
                <Grid>
                  <Field label={r.kind === "IN" ? "Người nộp" : "Người nhận"}><input name="counterparty" defaultValue={r.counterparty ?? ""} className="input" /></Field>
                  {r.kind === "OUT" && (
                    <Field label="Nhà cung cấp">
                      <select name="supplierId" defaultValue={r.supplierId ?? ""} className="input"><option value="">—</option>{suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                    </Field>
                  )}
                </Grid>
              )}
            </ActionForm>
          </ModalButton>
          <ConfirmButton label="Hủy chứng từ" icon={<XCircle size={15} />} title={`Hủy ${r.code}?`} confirmLabel="Hủy chứng từ"
            message={<>Chứng từ <b>{r.code}</b> ({r.description}) sẽ bị đánh dấu hủy và ghi bút toán đảo ngày hôm nay. Sổ cái vẫn giữ dấu vết.</>} action={voidVoucher.bind(null, r.id)} />
        </>
      )}
    </RowMenu>
  );
}
