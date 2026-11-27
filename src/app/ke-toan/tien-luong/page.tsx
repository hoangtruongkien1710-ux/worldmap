import { Banknote, FileUp, Lock, LockOpen, Pencil, ShieldCheck, Trash2, Undo2, Users, Wallet} from "lucide-react";
import { ExportLink } from "@/components/accounting/export-link";
import { PayrollImportForm } from "@/components/accounting/payroll-import";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard, Tabs, monthLabel } from "@/components/accounting/ui";
import { ActionForm, ConfirmButton, Field, Grid, ModalButton, RowMenu } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { db } from "@/lib/db";
import { guardPage, requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { fmtDate, todayVN } from "@/lib/dates";
import { money } from "@/lib/money";
import { SortTh } from "@/components/ui/sort-th";
import { loadPayroll } from "@/lib/accounting/loaders";
import { grossOf } from "@/lib/accounting/payroll";
import { cancelPayrollPayment, deletePayroll, deletePayrollLine, lockPayroll, payPayroll, unlockPayroll, updatePayrollLine } from "@/lib/actions/payroll";

export const metadata = { title: "Tiền lương" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  IMPORTED: { label: "Đã nhập, chờ chốt", cls: "bg-amber-50 text-amber-700" },
  LOCKED: { label: "Đã chốt, chưa trả", cls: "bg-sky-50 text-sky-700" },
  PAID: { label: "Đã trả lương", cls: "bg-green-50 text-green-700" },
};

type SP = { thang?: string; xep?: string; chieu?: string };
const BASE = "/ke-toan/tien-luong";
const dash = (n: number) => (n ? money(n) : "—");

function ImportButton({ variant = "primary" }: { variant?: "primary" | "btn" }) {
  return (
    <ModalButton label="Nhập bảng lương từ Excel" icon={<FileUp size={16} />} variant={variant} title="Nhập bảng lương từ Excel" subtitle="Chọn file, kiểm tra kết quả đọc rồi mới nhập" size="lg">
      <PayrollImportForm />
    </ModalButton>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  await guardPage("payroll.view");
  const user = await requireUser();
  const canPost = can(user.role, "accounting.post");
  const sp = await searchParams;
  const data = await loadPayroll(sp);
  if (!data) {
    return (
      <>
        <PageHeader title="Tiền lương" subtitle="Chưa nhập bảng lương tháng nào" actions={canPost ? <ImportButton /> : undefined} />
        <div className="card p-8 text-center text-sm text-slate-500">
          <p>Nhập file Excel bảng lương do kế toán lập (chấm công bằng máy riêng) để theo dõi, chốt và trả lương.</p>
          <p className="mt-2"><a className="font-semibold text-brand-600 hover:underline" href="/ke-toan/tien-luong/mau">Tải file Excel mẫu</a></p>
        </div>
      </>
    );
  }
  const { periods, period, lines, sort } = data;
  const accounts = canPost && period.status === "LOCKED" ? await db.cashAccount.findMany({ where: { active: true }, orderBy: { code: "asc" } }) : [];
  const params = { ...sp, thang: period.month };
  const th = (col: string, label: string, align?: "right", cls = "px-3 py-3") => <SortTh col={col} label={label} base={BASE} params={params} sort={sort} align={align} className={cls} />;
  type L = (typeof lines)[number];
  const sum = (f: (l: L) => number) => lines.reduce((s, l) => s + f(l), 0);
  const st = STATUS[period.status] ?? STATUS.IMPORTED;
  const editable = canPost && period.status === "IMPORTED";
  const monthTxt = `${period.month.slice(5)}/${period.month.slice(0, 4)}`;

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {canPost && <ImportButton variant="btn" />}
      <ExportLink base={BASE} params={params} />
    </div>
  );

  return (
    <>
      <PageHeader title="Tiền lương" subtitle={`Bảng lương tháng ${monthTxt} · nhập từ file ${period.sourceFile} ngày ${fmtDate(period.importedAt)}`} actions={actions} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs items={periods.map((p) => ({ href: `${BASE}?thang=${p.month}`, label: monthLabel(p.month), active: p.id === period.id }))} />
        <span className={`badge ${st.cls}`}>{st.label}</span>
        {canPost && (
          <div className="ml-auto flex flex-wrap gap-2">
            {period.status === "IMPORTED" && (
              <>
                <ConfirmButton variant="btn" label="Chốt bảng lương" icon={<Lock size={15} />} title={`Chốt bảng lương tháng ${monthTxt}`} confirmLabel="Chốt"
                  message="Ghi nhận chi phí lương và các khoản phải trả (BHXH, thuế TNCN, lương phải trả) vào sổ kế toán. Sau khi chốt không sửa được dòng lương, muốn sửa phải hủy chốt." action={lockPayroll.bind(null, period.id)} />
                <ConfirmButton variant="btn" label="Xóa bảng lương" icon={<Trash2 size={15} />} title={`Xóa bảng lương tháng ${monthTxt}`} message="Xóa toàn bộ bảng lương tháng này (chưa chốt). Nhân sự đã tạo khi nhập vẫn được giữ lại." action={deletePayroll.bind(null, period.id)} />
              </>
            )}
            {period.status === "LOCKED" && (
              <>
                <ModalButton variant="primary" label="Trả lương" icon={<Wallet size={15} />} title={`Trả lương tháng ${monthTxt}`} subtitle={`Tổng thực lĩnh ${money(sum((l) => l.netPay))}`} size="sm">
                  <ActionForm action={payPayroll.bind(null, period.id)} submitLabel="Lập chứng từ trả lương">
                    <Field label="Trả từ quỹ / tài khoản">
                      <select name="accountId" required defaultValue="" className="input">
                        <option value="" disabled>Chọn nguồn tiền</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Ngày trả"><input type="date" name="date" defaultValue={todayVN()} required className="input" /></Field>
                  </ActionForm>
                </ModalButton>
                <ConfirmButton variant="btn" label="Hủy chốt" icon={<LockOpen size={15} />} title="Hủy chốt bảng lương" confirmLabel="Hủy chốt" message="Xóa bút toán chi phí lương của tháng này, bảng lương trở về trạng thái chờ chốt để sửa." action={unlockPayroll.bind(null, period.id)} />
              </>
            )}
            {period.status === "PAID" && (
              <ConfirmButton variant="btn" label="Hủy trả lương" icon={<Undo2 size={15} />} title="Hủy trả lương" confirmLabel="Hủy chứng từ" message="Hủy chứng từ chi lương (ghi bút toán đảo), bảng lương về trạng thái đã chốt." action={cancelPayrollPayment.bind(null, period.id)} />
            )}
          </div>
        )}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard tone="violet" icon={<Banknote size={20} />} label="Tổng lương (trước khấu trừ)" value={money(sum(grossOf))} hint={`${lines.length} nhân sự`} />
        <StatCard tone="sky" icon={<ShieldCheck size={20} />} label="BHXH + thuế + ứng lương" value={money(sum((l) => l.insurance + l.pit + l.advance))} hint={`BHXH ${money(sum((l) => l.insurance))} · Thuế ${money(sum((l) => l.pit))} · Ứng ${money(sum((l) => l.advance))}`} />
        <StatCard tone="emerald" icon={<Users size={20} />} label="Thực lĩnh" value={money(sum((l) => l.netPay))} />
      </div>
      <div className="card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-slate-50 text-left text-xs">
              <tr className="[&>th]:border-b [&>th]:border-slate-200">
                <th className="sticky left-0 z-30 w-12 border-b border-slate-200 bg-slate-50 px-3 py-3">STT</th>
                {th("ten", "Họ tên", undefined, "sticky left-12 z-30 bg-slate-50 px-3 py-3 min-w-[180px]")}
                {th("chucvu", "Chức vụ")}{th("dinhmuc", "Định mức", "right")}{th("cong", "Ngày công", "right")}{th("buoi", "Buổi dạy", "right")}
                {th("luong", "Lương chính", "right")}{th("tangca", "Tăng ca", "right")}{th("le", "Ngày lễ", "right")}{th("phucap", "Phụ cấp", "right")}{th("thuong", "Thưởng", "right")}
                {th("bhxh", "BHXH", "right")}{th("thue", "Thuế TNCN", "right")}{th("tong", "Tổng lương", "right")}{th("ung", "Ứng lương", "right")}{th("thuclinh", "Thực lĩnh", "right")}
                {editable && <th className="w-10 border-b border-slate-200 bg-slate-50" />}
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)>td]:bg-slate-50 [&>tr>td]:border-b [&>tr>td]:border-slate-100 [&>tr>td]:bg-white">
              {lines.map((l, i) => (
                <tr key={l.id} className="hover:[&>td]:bg-slate-100/60">
                  <td className="sticky left-0 z-10 px-3 py-2.5 text-slate-400">{i + 1}</td>
                  <td className="sticky left-12 z-10 min-w-[180px] px-3 py-2.5 font-medium"><div>{l.employee.fullName}</div><div className="text-xs font-normal text-slate-400">{l.employee.code}</div></td>
                  <td className="px-3 py-2.5 text-slate-600">{l.employee.position ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{dash(l.salaryNorm)}</td>
                  <td className="px-3 py-2.5 text-right">{Number(l.workDays)}</td>
                  <td className="px-3 py-2.5 text-right">{l.teachingSessions ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(l.baseSalary)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{dash(l.overtimePay)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{dash(l.holidayPay)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{dash(l.allowance)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{dash(l.bonus)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{dash(l.insurance)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{dash(l.pit)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{money(grossOf(l))}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{dash(l.advance)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold text-emerald-700">{money(l.netPay)}</td>
                  {editable && (
                    <td className="px-2 py-2.5">
                      <RowMenu>
                        <ModalButton variant="menu" label="Sửa dòng lương" icon={<Pencil size={15} />} title={`Sửa lương ${l.employee.fullName}`} subtitle="Tổng lương và thực lĩnh tự tính lại" size="md">
                          <ActionForm action={updatePayrollLine.bind(null, l.id)}>
                            <Grid cols={3}>
                              <Field label="Định mức"><MoneyInput name="salaryNorm" defaultValue={l.salaryNorm} /></Field>
                              <Field label="Ngày công"><input name="workDays" inputMode="decimal" defaultValue={Number(l.workDays)} className="input" /></Field>
                              <Field label="Buổi dạy"><input name="teachingSessions" inputMode="numeric" defaultValue={l.teachingSessions ?? ""} className="input" /></Field>
                              <Field label="Lương chính"><MoneyInput name="baseSalary" defaultValue={l.baseSalary} /></Field>
                              <Field label="Tăng ca"><MoneyInput name="overtimePay" defaultValue={l.overtimePay} /></Field>
                              <Field label="Ngày lễ"><MoneyInput name="holidayPay" defaultValue={l.holidayPay} /></Field>
                              <Field label="Phụ cấp"><MoneyInput name="allowance" defaultValue={l.allowance} /></Field>
                              <Field label="Thưởng"><MoneyInput name="bonus" defaultValue={l.bonus} /></Field>
                              <Field label="BHXH"><MoneyInput name="insurance" defaultValue={l.insurance} /></Field>
                              <Field label="Thuế TNCN"><MoneyInput name="pit" defaultValue={l.pit} /></Field>
                              <Field label="Ứng lương"><MoneyInput name="advance" defaultValue={l.advance} /></Field>
                            </Grid>
                          </ActionForm>
                        </ModalButton>
                        <ConfirmButton label="Bỏ khỏi bảng lương" icon={<Trash2 size={15} />} title="Bỏ khỏi bảng lương" message={`Bỏ ${l.employee.fullName} khỏi bảng lương tháng ${monthTxt}?`} action={deletePayrollLine.bind(null, l.id)} confirmLabel="Bỏ" />
                      </RowMenu>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="font-bold [&>tr>td]:border-t-2 [&>tr>td]:border-slate-200 [&>tr>td]:bg-slate-50">
              <tr>
                <td className="sticky left-0 z-10 px-3 py-3" />
                <td className="sticky left-12 z-10 px-3 py-3">TỔNG CỘNG</td>
                <td colSpan={3} />
                <td className="px-3 py-3 text-right">{sum((l) => l.teachingSessions ?? 0)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(sum((l) => l.baseSalary))}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(sum((l) => l.overtimePay))}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(sum((l) => l.holidayPay))}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(sum((l) => l.allowance))}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(sum((l) => l.bonus))}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(sum((l) => l.insurance))}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(sum((l) => l.pit))}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(sum(grossOf))}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(sum((l) => l.advance))}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-700">{money(sum((l) => l.netPay))}</td>
                {editable && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Quy trình: Nhập Excel → kiểm tra → Chốt (ghi sổ chi phí lương) → Trả lương (chi tiền từ quỹ/ngân hàng). Công thức: Tổng lương = Lương chính + Tăng ca + Ngày lễ + Phụ cấp + Thưởng; Thực lĩnh = Tổng lương − BHXH − Thuế − Ứng lương.</p>
    </>
  );
}
