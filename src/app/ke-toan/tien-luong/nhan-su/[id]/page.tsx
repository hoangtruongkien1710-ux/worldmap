import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarCheck, Pencil, TrendingUp, Wallet } from "lucide-react";
import { ExportLink } from "@/components/accounting/export-link";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard, Tabs, monthLabel } from "@/components/accounting/ui";
import { ActionForm, Field, Grid, ModalButton } from "@/components/ui/modal";
import { guardPage, requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { money } from "@/lib/money";
import { loadStaffDetail, type StaffSP } from "@/lib/accounting/loaders";
import { DepartmentSelect } from "@/components/accounting/department-select";
import { updateEmployee } from "@/lib/actions/payroll";

export const dynamic = "force-dynamic";

const Delta = ({ d }: { d: number }) => d > 0 ? <span className="inline-flex items-center text-xs font-semibold text-emerald-700"><ArrowUp size={12} />{money(d)}</span>
  : d < 0 ? <span className="inline-flex items-center text-xs font-semibold text-rose-600"><ArrowDown size={12} />{money(-d)}</span> : null;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<StaffSP> }) {
  await guardPage("payroll.view");
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const d = await loadStaffDetail(id, sp);
  if (!d) notFound();
  const { e, all, lines, years, nam, changes, departments } = d;
  const BASE = `/ke-toan/tien-luong/nhan-su/${e.id}`;
  const last = all[all.length - 1];
  const avg = (f: (l: (typeof lines)[number]) => number) => (lines.length ? Math.round(lines.reduce((s, l) => s + f(l), 0) / lines.length) : 0);
  const teacher = all.some((l) => (l.sessions ?? 0) > 0);
  const deptName = departments.find((x) => x.code === e.department)?.name ?? e.department;
  return (
    <>
      <Link href="/ke-toan/tien-luong/nhan-su" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"><ArrowLeft size={15} />Hồ sơ nhân sự</Link>
      <PageHeader title={e.fullName} subtitle={`${e.code} · ${e.position ?? "Chưa có chức vụ"} · ${deptName}${e.active ? "" : " · đã nghỉ"}`}
        actions={<>
          {can(user.role, "accounting.post") && (
            <ModalButton label="Sửa thông tin" icon={<Pencil size={15} />} title="Sửa thông tin nhân sự" size="sm">
              <ActionForm action={updateEmployee.bind(null, e.id)}>
                <Field label="Họ tên"><input name="fullName" defaultValue={e.fullName} maxLength={60} required className="input" /></Field>
                <Grid>
                  <Field label="Chức vụ"><input name="position" defaultValue={e.position ?? ""} className="input" /></Field>
                  <DepartmentSelect departments={departments.map((x) => ({ code: x.code, name: x.name }))} defaultValue={e.department} />
                </Grid>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" value="1" defaultChecked={e.active} /> Đang làm việc</label>
              </ActionForm>
            </ModalButton>
          )}
          <ExportLink base={BASE} params={{ nam: nam || undefined }} />
        </>} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard tone="violet" icon={<Wallet size={20} />} label="Lương chính hiện tại" value={last ? money(last.baseSalary) : "—"} hint={last ? `${monthLabel(last.month)}${last.salaryNorm ? ` · định mức ${money(last.salaryNorm)}` : ""}` : "Chưa có bảng lương"} />
        <StatCard tone="emerald" icon={<TrendingUp size={20} />} label={`Thực lĩnh trung bình${nam ? ` ${nam}` : ""}`} value={money(avg((l) => l.netPay))} hint={`${lines.length} tháng`} />
        <StatCard tone="sky" icon={<CalendarCheck size={20} />} label={`Ngày công / buổi dạy TB${nam ? ` ${nam}` : ""}`} value={`${(Math.round(avg((l) => l.workDays * 100)) / 100).toLocaleString("vi-VN")} ngày`} hint={teacher ? `${avg((l) => l.sessions ?? 0)} buổi/tháng` : undefined} />
      </div>
      {years.length > 1 && <div className="mb-4"><Tabs items={[{ href: BASE, label: "Tất cả", active: !nam }, ...years.map((y) => ({ href: `${BASE}?nam=${y}`, label: `Năm ${y}`, active: nam === y }))]} /></div>}
      {changes.length > 0 && (
        <div className="card mb-4 p-4">
          <h2 className="mb-2 text-sm font-bold">Lịch sử thay đổi lương</h2>
          <ul className="space-y-1 text-sm">
            {changes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <span className="w-24 font-medium">{monthLabel(c.month)}</span>
                {c.dBase !== 0 && <span>Lương chính {money(c.baseSalary - c.dBase)} → <b>{money(c.baseSalary)}</b> <Delta d={c.dBase} /></span>}
                {c.dNorm !== 0 && <span className="text-slate-500">· Định mức {money(c.salaryNorm - c.dNorm)} → {money(c.salaryNorm)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs"><tr>
              <th className="px-4 py-3">Tháng</th><th className="px-3 py-3 text-right">Định mức</th><th className="px-3 py-3 text-right">Ngày công</th><th className="px-3 py-3 text-right">Buổi dạy</th>
              <th className="px-3 py-3 text-right">Lương chính</th><th className="px-3 py-3 text-right">Tổng lương</th><th className="px-4 py-3 text-right">Thực lĩnh</th>
            </tr></thead>
            <tbody className="[&>tr>td]:border-t [&>tr>td]:border-slate-100">
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5"><Link href={`/ke-toan/tien-luong?thang=${l.month}`} className="font-semibold text-brand-700 hover:underline">{monthLabel(l.month)}</Link></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{l.salaryNorm ? money(l.salaryNorm) : "—"}</td>
                  <td className="px-3 py-2.5 text-right">{l.workDays}</td>
                  <td className="px-3 py-2.5 text-right">{l.sessions ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(l.baseSalary)} <Delta d={l.dBase} /></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(l.gross)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold text-emerald-700">{money(l.netPay)}</td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Chưa có tháng lương nào.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
