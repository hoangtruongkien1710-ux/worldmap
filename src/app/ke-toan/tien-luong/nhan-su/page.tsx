import Link from "next/link";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Tabs, monthLabel } from "@/components/accounting/ui";
import { guardPage } from "@/lib/auth/session";
import { money } from "@/lib/money";
import { loadStaff, type StaffSP } from "@/lib/accounting/loaders";

export const metadata = { title: "Hồ sơ nhân sự" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<StaffSP> }) {
  await guardPage("payroll.view");
  const sp = await searchParams;
  const { rows, q, departments } = await loadStaff(sp);
  const deptName = new Map(departments.map((d) => [d.code, d.name]));
  return (
    <>
      <PageHeader title="Hồ sơ nhân sự" subtitle="Theo dõi lương chính, ngày công, buổi dạy của từng người qua các tháng" />
      <div className="mb-4"><Tabs items={[{ href: "/ke-toan/tien-luong", label: "Bảng lương theo tháng", active: false }, { href: "/ke-toan/tien-luong/nhan-su", label: "Hồ sơ nhân sự", active: true }]} /></div>
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_160px_160px_auto]" action="/ke-toan/tien-luong/nhan-su">
        <label className="relative block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Tìm theo tên, mã, chức vụ" className="input pl-9" />
        </label>
        <select name="bp" defaultValue={sp.bp ?? ""} className="input"><option value="">Mọi bộ phận</option>{departments.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}</select>
        <select name="tt" defaultValue={sp.tt ?? ""} className="input"><option value="">Đang làm</option><option value="nghi">Đã nghỉ</option><option value="tatca">Tất cả</option></select>
        <button className="btn btn-primary">Lọc</button>
      </form>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs"><tr>
              <th className="px-4 py-3">Nhân sự</th><th className="px-3 py-3">Bộ phận</th><th className="px-3 py-3">Tháng gần nhất</th>
              <th className="px-3 py-3 text-right">Lương chính</th><th className="px-3 py-3 text-right">So tháng trước</th>
              <th className="px-3 py-3 text-right">Ngày công</th><th className="px-3 py-3 text-right">Buổi dạy</th><th className="px-4 py-3 text-right">Thực lĩnh</th>
            </tr></thead>
            <tbody className="[&>tr>td]:border-t [&>tr>td]:border-slate-100">
              {rows.map(({ e, last, prev }) => {
                const d = last && prev ? last.baseSalary - prev.baseSalary : 0;
                return (
                  <tr key={e.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <Link href={`/ke-toan/tien-luong/nhan-su/${e.id}`} className="font-semibold text-brand-700 hover:underline">{e.fullName}</Link>
                      <div className="text-xs text-slate-500">{e.code} · {e.position ?? "—"}{!e.active && " · đã nghỉ"}</div>
                    </td>
                    <td className="px-3 py-2.5">{deptName.get(e.department) ?? e.department}</td>
                    <td className="px-3 py-2.5">{last ? monthLabel(last.period.month) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">{last ? money(last.baseSalary) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      {d > 0 ? <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700"><ArrowUp size={13} />{money(d)}</span>
                        : d < 0 ? <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600"><ArrowDown size={13} />{money(-d)}</span> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">{last ? Number(last.workDays) : "—"}</td>
                    <td className="px-3 py-2.5 text-right">{last?.teachingSessions ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold text-emerald-700">{last ? money(last.netPay) : "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Không có nhân sự phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
