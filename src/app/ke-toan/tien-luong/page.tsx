import { Banknote, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard, Tabs, monthLabel } from "@/components/accounting/ui";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";

export const metadata = { title: "Tiền lương" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  IMPORTED: { label: "Đã nhập, chờ chốt", cls: "bg-amber-50 text-amber-700" },
  LOCKED: { label: "Đã chốt, chưa trả", cls: "bg-sky-50 text-sky-700" },
  PAID: { label: "Đã trả lương", cls: "bg-green-50 text-green-700" },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ thang?: string }> }) {
  await guardPage("payroll.view");
  const sp = await searchParams;
  const periods = await db.payrollPeriod.findMany({ orderBy: { month: "desc" } });
  const period = periods.find((p) => p.month === sp.thang) ?? periods[0];
  if (!period) return <PageHeader title="Tiền lương" subtitle="Chưa nhập bảng lương tháng nào" />;
  const lines = await db.payrollLine.findMany({ where: { periodId: period.id }, include: { employee: true }, orderBy: { employee: { code: "asc" } } });
  const sum = (f: (l: (typeof lines)[number]) => number) => lines.reduce((s, l) => s + f(l), 0);
  const gross = (l: (typeof lines)[number]) => l.baseSalary + l.allowance + l.bonus - l.deduction;
  const st = STATUS[period.status] ?? STATUS.IMPORTED;

  return (
    <>
      <PageHeader title="Tiền lương" subtitle={`Bảng lương nhập từ file ${period.sourceFile} ngày ${fmtDate(period.importedAt)} (chấm công bằng máy riêng)`} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs items={periods.map((p) => ({ href: `/ke-toan/tien-luong?thang=${p.month}`, label: monthLabel(p.month), active: p.id === period.id }))} />
        <span className={`badge ${st.cls}`}>{st.label}</span>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard tone="violet" icon={<Banknote size={20} />} label="Tổng thu nhập" value={money(sum(gross))} hint={`${lines.length} nhân sự`} />
        <StatCard tone="sky" icon={<ShieldCheck size={20} />} label="BHXH + thuế TNCN khấu trừ" value={money(sum((l) => l.insurance + l.pit))} />
        <StatCard tone="emerald" icon={<Users size={20} />} label="Thực lĩnh" value={money(sum((l) => l.netPay))} />
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Mã NV</th><th className="px-3 py-3">Họ tên</th><th className="px-3 py-3 text-right">Ngày công</th><th className="px-3 py-3 text-right">Buổi dạy</th>
                <th className="px-3 py-3 text-right">Lương chính</th><th className="px-3 py-3 text-right">Phụ cấp</th><th className="px-3 py-3 text-right">Thưởng</th>
                <th className="px-3 py-3 text-right">BHXH</th><th className="px-3 py-3 text-right">Thuế TNCN</th><th className="px-4 py-3 text-right">Thực lĩnh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-semibold">{l.employee.code}</td>
                  <td className="px-3 py-2.5"><div>{l.employee.fullName}</div><div className="text-xs text-slate-500">{l.employee.position}</div></td>
                  <td className="px-3 py-2.5 text-right">{Number(l.workDays)}</td>
                  <td className="px-3 py-2.5 text-right">{l.teachingSessions ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(l.baseSalary)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(l.allowance)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{l.bonus ? money(l.bonus) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{l.insurance ? money(l.insurance) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{l.pit ? money(l.pit) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold text-emerald-700">{money(l.netPay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 font-bold">
              <tr>
                <td className="px-4 py-3" colSpan={4}>Cộng</td>
                <td className="px-3 py-3 text-right">{money(sum((l) => l.baseSalary))}</td>
                <td className="px-3 py-3 text-right">{money(sum((l) => l.allowance))}</td>
                <td className="px-3 py-3 text-right">{money(sum((l) => l.bonus))}</td>
                <td className="px-3 py-3 text-right">{money(sum((l) => l.insurance))}</td>
                <td className="px-3 py-3 text-right">{money(sum((l) => l.pit))}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{money(sum((l) => l.netPay))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Giáo viên tính theo số buổi dạy thực tế trong tháng. Nút nhập file Excel bảng lương sẽ có ở giai đoạn 5b.</p>
    </>
  );
}
