import Link from "next/link";
import clsx from "clsx";
import { CircleCheck, Hourglass, LayoutList, Receipt, Search, UserCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { FilterForm, FilterSelect } from "@/components/classes/filter-form";
import { CollectButton, ExcelLink, HistoryButton, MonthNav, RingStat, SheetStatus, Trend } from "@/components/tuition/ui";
import { Phones } from "@/components/students/phones";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { monthOf, shiftMonth, todayVN } from "@/lib/dates";
import { money } from "@/lib/money";
import { filterSheets, monthShort, tuitionSheets, type FeeSheet } from "@/lib/tuition/month";

export const metadata = { title: "Học phí" };
export const dynamic = "force-dynamic";

type SP = { thang?: string; tab?: string; q?: string; lop?: string; khoi?: string; tt?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await guardPage("tuition.view");
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.thang ?? "") ? sp.thang! : monthOf(todayVN());
  const prevMonth = shiftMonth(month, -1);
  const tab = sp.tab === "lop" ? "lop" : "hs";
  const [all, prev, classes, grades, accounts] = await Promise.all([
    tuitionSheets(month),
    tuitionSheets(prevMonth),
    db.class.findMany({ select: { code: true, name: true, status: true }, orderBy: [{ status: "asc" }, { name: "asc" }] }),
    db.grade.findMany({ orderBy: { order: "asc" } }),
    db.cashAccount.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, name: true, kind: true } }),
  ]);
  const canCollect = can(user.role, "tuition.collect");
  const sum = (xs: FeeSheet[], k: "total" | "paid" | "remain") => xs.reduce((s, x) => s + x[k], 0);
  const total = sum(all, "total"), paid = sum(all, "paid"), remain = sum(all, "remain");
  const items = all.reduce((s, x) => s + x.items.length, 0);
  const full = all.filter((s) => s.status === "paid").length;
  const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

  const sheets = filterSheets(all, sp);
  const keep = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ thang: sp.thang, tab: sp.tab, q: sp.q, lop: sp.lop, khoi: sp.khoi, tt: sp.tt, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/hoc-phi?${s}` : "/hoc-phi";
  };
  const filtered = !!(sp.q || sp.lop || sp.khoi || sp.tt);
  const usedClasses = new Set(all.flatMap((s) => s.items.map((i) => i.classCode)));

  return (
    <>
      <PageHeader title="Học phí" subtitle="Phiếu học phí gộp theo học viên trong tháng: lớp theo buổi tính theo số buổi đã học, lớp trọn khóa tính theo phiếu đã chốt"
        actions={<><MonthNav month={month} href={(m) => keep({ thang: m })} /><ExcelLink href={`/hoc-phi/xuat?${new URLSearchParams({ thang: month }).toString()}`} /></>} />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RingStat icon={<Receipt size={15} className="text-brand-600" />} label={`Dự kiến thu ${monthShort(month)}`} value={money(total)} color="#2563eb" pct={100} ring={`${all.length} HS`}
          hint={<><Trend now={total} prev={sum(prev, "total")} /> so tháng trước · {items} lượt học / {all.length} học viên</>} />
        <RingStat icon={<CircleCheck size={15} className="text-emerald-600" />} label="Đã thu" value={money(paid)} color="#10b981" pct={pct(paid, total)} hint={`Đạt ${Math.round(pct(paid, total))}% dự kiến`} />
        <RingStat icon={<Hourglass size={15} className="text-rose-600" />} label="Còn phải thu" value={money(remain)} color="#ef4444" pct={pct(remain, total)} hint={`${all.length - full} học viên chưa đóng đủ`} />
        <RingStat icon={<UserCheck size={15} className="text-violet-600" />} label="Học viên đã đóng đủ" value={`${full} / ${all.length}`} color="#8b5cf6" pct={pct(full, all.length)} hint="Phiếu gộp theo học viên" />
      </div>

      <section className="card overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3">
          <TabLink href={keep({ tab: undefined })} active={tab === "hs"} icon={<Users size={16} />} label="Phiếu gộp theo học viên" count={sheets.length} />
          <TabLink href={keep({ tab: "lop" })} active={tab === "lop"} icon={<LayoutList size={16} />} label="Chi tiết theo lớp" count={sheets.reduce((s, x) => s + x.items.length, 0)} />
        </div>
        <FilterForm action="/hoc-phi" resetHref={keep({ q: undefined, lop: undefined, khoi: undefined, tt: undefined })} active={filtered}
          className="grid grid-cols-2 gap-3 border-b border-slate-100 p-3 md:grid-cols-6 xl:grid-cols-12">
          <input type="hidden" name="thang" value={sp.thang ?? ""} />
          <input type="hidden" name="tab" value={sp.tab ?? ""} />
          <label className="col-span-2 block md:col-span-6 xl:col-span-4">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Tìm kiếm</span>
            <span className="relative block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={sp.q} placeholder="Tìm học viên, mã, phụ huynh, số điện thoại…" className="input w-full" style={{ paddingLeft: 36 }} /></span>
          </label>
          <div className="md:col-span-2"><FilterSelect label="Lớp" name="lop" value={sp.lop}><option value="">Tất cả lớp</option>{classes.filter((c) => usedClasses.has(c.code)).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</FilterSelect></div>
          <div className="md:col-span-2"><FilterSelect label="Khối" name="khoi" value={sp.khoi}><option value="">Tất cả khối</option>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</FilterSelect></div>
          <div className="md:col-span-2"><FilterSelect label="Trạng thái" name="tt" value={sp.tt}><option value="">Tất cả trạng thái</option><option value="chua-thu">Chưa thu</option><option value="mot-phan">Thu một phần</option><option value="da-du">Đã thu đủ</option></FilterSelect></div>
        </FilterForm>

        <div className="overflow-x-auto">
          {tab === "hs" ? (
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="text-left text-xs font-semibold text-slate-500">
                <tr className="border-b border-slate-100"><th className="px-4 py-3">Học viên</th><th className="w-[44%] px-3 py-3">Các lớp & cách tính</th><th className="px-3 py-3 text-right">Tổng tiền</th><th className="px-3 py-3 text-right">Đã thu</th><th className="px-3 py-3 text-right">Còn lại</th><th className="px-3 py-3">Trạng thái</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sheets.length === 0 && <Empty cols={7} />}
                {sheets.map((s) => (
                  <tr key={s.key} className="align-middle hover:bg-slate-50/60">
                    <td className="px-4 py-2.5"><StudentCell s={s} /></td>
                    <td className="px-3 py-2.5">
                      {s.items.map((i) => (
                        <div key={i.key} className="flex items-baseline justify-between gap-4 py-0.5">
                          <span className="min-w-0"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: i.color }} /><b>{i.className}</b> <span className="text-slate-500">· {i.how}</span></span>
                          <b className="whitespace-nowrap">{money(i.amount)}</b>
                        </div>
                      ))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold">{money(s.total)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">{s.paid ? money(s.paid) : <span className="text-slate-400">—</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-rose-600">{s.remain ? money(s.remain) : <span className="font-normal text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5"><SheetStatus s={s.status} /></td>
                    <td className="px-4 py-2.5"><div className="flex items-center justify-end gap-1">{canCollect && <CollectButton sheet={s} accounts={accounts} />}<HistoryButton sheet={s} canCollect={canCollect} /></div></td>
                  </tr>
                ))}
              </tbody>
              {sheets.length > 0 && <Totals sheets={sheets} label={`${sheets.length} phiếu`} span={2} />}
            </table>
          ) : (
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="text-left text-xs font-semibold text-slate-500">
                <tr className="border-b border-slate-100"><th className="px-4 py-3">Học viên</th><th className="px-3 py-3">Lớp</th><th className="px-3 py-3">Cách tính</th><th className="px-3 py-3 text-right">Thành tiền</th><th className="px-3 py-3 text-right">Đã thu</th><th className="px-3 py-3 text-right">Còn lại</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sheets.length === 0 && <Empty cols={7} />}
                {sheets.flatMap((s) => s.items.filter((i) => !sp.lop || i.classCode === sp.lop).map((i) => (
                  <tr key={i.key} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5"><StudentCell s={s} /></td>
                    <td className="px-3 py-2.5"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: i.color }} /><b>{i.className}</b></td>
                    <td className="px-3 py-2.5 text-slate-500">{i.how}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold">{money(i.amount)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">{i.paid ? money(i.paid) : <span className="text-slate-400">—</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-rose-600">{i.remain ? money(i.remain) : <span className="badge bg-green-50 font-semibold text-green-700">Đủ</span>}</td>
                    <td className="px-4 py-2.5 text-right">{canCollect && i.remain > 0 && <CollectButton sheet={s} accounts={accounts} />}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      <p className="mt-3 text-xs text-slate-400">Phiếu “chưa chốt” là ghi danh đang học nhưng chưa chốt học phí, tạm tính theo số buổi đã học đến hôm nay. Xem các tháng còn nợ ở <Link href="/cong-no" className="underline">Công nợ</Link>.</p>
    </>
  );
}

function TabLink({ href, active, icon, label, count }: { href: string; active: boolean; icon: React.ReactNode; label: string; count: number }) {
  return (
    <Link href={href} className={clsx("-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold",
      active ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-800")}>
      {icon}{label}<span className={clsx("rounded-full px-2 py-0.5 text-xs", active ? "bg-brand-50" : "bg-slate-100")}>{count}</span>
    </Link>
  );
}

function StudentCell({ s }: { s: FeeSheet }) {
  return (
    <div className="min-w-[140px]">
      <Link href={`/hoc-sinh/${s.student.code}`} className="font-semibold hover:underline">{s.student.fullName}</Link>
      <div className="text-xs text-slate-500">{s.student.code}{s.student.grade ? ` · ${s.student.grade.name}` : ""}{s.invoiceId ? "" : " · chưa chốt"}</div>
      <Phones s={s.student} />
    </div>
  );
}

function Empty({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="px-4 py-10 text-center text-slate-500">Không có phiếu học phí nào khớp bộ lọc.</td></tr>;
}

function Totals({ sheets, label, span }: { sheets: FeeSheet[]; label: string; span: number }) {
  const t = (k: "total" | "paid" | "remain") => sheets.reduce((s, x) => s + x[k], 0);
  return (
    <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
      <tr><td colSpan={span} className="px-4 py-3">Tổng · {label}</td><td className="whitespace-nowrap px-3 py-3 text-right">{money(t("total"))}</td><td className="whitespace-nowrap px-3 py-3 text-right text-emerald-700">{money(t("paid"))}</td><td className="whitespace-nowrap px-3 py-3 text-right text-rose-600">{money(t("remain"))}</td><td colSpan={2} /></tr>
    </tfoot>
  );
}
