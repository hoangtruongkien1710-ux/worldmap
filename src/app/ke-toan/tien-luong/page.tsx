import { Banknote, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard, Tabs, monthLabel } from "@/components/accounting/ui";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { SortTh } from "@/components/ui/sort-th";
import { parseSort, sortRows } from "@/lib/sort";

export const metadata = { title: "Tiền lương" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  IMPORTED: { label: "Đã nhập, chờ chốt", cls: "bg-amber-50 text-amber-700" },
  LOCKED: { label: "Đã chốt, chưa trả", cls: "bg-sky-50 text-sky-700" },
  PAID: { label: "Đã trả lương", cls: "bg-green-50 text-green-700" },
};

type SP = { thang?: string; xep?: string; chieu?: string };
const BASE = "/ke-toan/tien-luong";

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  await guardPage("payroll.view");
  const sp = await searchParams;
  const periods = await db.payrollPeriod.findMany({ orderBy: { month: "desc" } });
  const period = periods.find((p) => p.month === sp.thang) ?? periods[0];
  if (!period) return <PageHeader title="Tiền lương" subtitle="Chưa nhập bảng lương tháng nào" />;
  const params = { ...sp, thang: period.month };
  const sort = parseSort(sp, ["ma", "ten", "cong", "buoi", "luong", "phucap", "thuong", "bhxh", "thue", "thuclinh"]);
  const raw = await db.payrollLine.findMany({ where: { periodId: period.id }, include: { employee: true }, orderBy: { employee: { code: "asc" } } });
  const lines = sortRows(raw, sort, {
    ma: (l) => l.employee.code, ten: (l) => l.employee.fullName, cong: (l) => Number(l.workDays), buoi: (l) => l.teachingSessions, luong: (l) => l.baseSalary,
    phucap: (l) => l.allowance, thuong: (l) => l.bonus, bhxh: (l) => l.insurance, thue: (l) => l.pit, thuclinh: (l) => l.netPay,
  });
  const th = (col: string, label: string, align?: "right") => <SortTh col={col} label={label} base={BASE} params={params} sort={sort} align={align} className="px-3 py-3" />;
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
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs">
              <tr className="[&>th]:border-b [&>th]:border-slate-200">
                {th("ma", "Mã NV")}{th("ten", "Họ tên")}{th("cong", "Ngày công", "right")}{th("buoi", "Buổi dạy", "right")}{th("luong", "Lương chính", "right")}{th("phucap", "Phụ cấp", "right")}
                {th("thuong", "Thưởng", "right")}{th("bhxh", "BHXH", "right")}{th("thue", "Thuế TNCN", "right")}{th("thuclinh", "Thực lĩnh", "right")}
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-slate-50/50 [&>tr>td]:border-b [&>tr>td]:border-slate-100">
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
