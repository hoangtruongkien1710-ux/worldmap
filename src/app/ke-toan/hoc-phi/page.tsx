import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, CircleCheck, HandCoins, Receipt } from "lucide-react";
import { ExportLink } from "@/components/accounting/export-link";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard, Tabs } from "@/components/accounting/ui";
import { PeriodBar, SearchForm, qs } from "@/components/accounting/period-bar";
import { SortTh } from "@/components/ui/sort-th";
import { guardPage } from "@/lib/auth/session";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";
import type { PeriodSP } from "@/lib/accounting/period";
import { loadFees } from "@/lib/accounting/loaders";

export const metadata = { title: "Học phí & thu khác" };
export const dynamic = "force-dynamic";

type SP = PeriodSP & { tt?: string; q?: string; xep?: string; chieu?: string };
const BASE = "/ke-toan/hoc-phi";

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  await guardPage("accounting.view");
  const sp = await searchParams;
  const { period, filter, all, shown, sort } = await loadFees(sp);
  const sum = (f: (r: (typeof all)[number]) => number) => all.reduce((s, r) => s + f(r), 0);
  const th = (col: string, label: string, align?: "right") => <SortTh col={col} label={label} base={BASE} params={sp} sort={sort} align={align} className="px-3 py-3" />;

  return (
    <>
      <PageHeader title="Học phí & thu khác" subtitle="Học phí ghi nhận khi khai giảng; thu tiền mặt hoặc chuyển khoản theo từng đợt" actions={<ExportLink base={BASE} params={sp} />} />
      <PeriodBar base={BASE} period={period} params={sp} allowAll />
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard tone="indigo" icon={<Receipt size={20} />} label="Học phí đã ghi nhận" value={money(sum((r) => r.total))} hint={`${all.length} phiếu báo học phí · ${period.label}`} />
        <StatCard tone="emerald" icon={<CircleCheck size={20} />} label="Đã thu" value={money(sum((r) => r.paid))} hint={`${all.filter((r) => r.remain <= 0).length} học viên đã đóng đủ`} />
        <StatCard tone="rose" icon={<HandCoins size={20} />} label="Còn phải thu" value={money(sum((r) => Math.max(0, r.remain)))} hint={`${all.filter((r) => r.remain > 0).length} học viên còn nợ`} />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={[
          { href: `${BASE}${qs(sp, { tt: undefined })}`, label: "Tất cả", active: filter === "all" },
          { href: `${BASE}${qs(sp, { tt: "con-no" })}`, label: "Còn nợ", active: filter === "debt" },
          { href: `${BASE}${qs(sp, { tt: "da-du" })}`, label: "Đã đóng đủ", active: filter === "paid" },
        ]} />
        <SearchForm base={BASE} params={sp} placeholder="Tên, mã học viên, SĐT" />
      </div>
      <div className="card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs">
              <tr className="[&>th]:border-b [&>th]:border-slate-200">
                {th("hv", "Học viên")}{th("thang", "Tháng")}{th("lop", "Lớp / khóa")}{th("phaithu", "Phải thu", "right")}
                <th className="hidden px-3 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 2xl:table-cell">Các lần thu</th>
                {th("dathu", "Đã thu", "right")}{th("thucuoi", "Thu gần nhất")}{th("conlai", "Còn lại", "right")}<th className="w-10" />
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-slate-50/50 [&>tr>td]:border-b [&>tr>td]:border-slate-100">
              {shown.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Không có phiếu học phí phù hợp.</td></tr>}
              {shown.map((r) => (
                <tr key={r.id} className="align-top hover:bg-acc-50/40">
                  <td className="min-w-44 px-4 py-3">
                    <Link href={`${BASE}/${r.id}`} className="font-semibold hover:text-acc-700 hover:underline">{r.student.fullName}</Link>
                    <div className="text-xs text-slate-500">{r.student.code} · {r.student.parentPhone ?? r.student.phone ?? ""}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.month.slice(5)}/{r.month.slice(0, 4)}</td>
                  <td className="px-3 py-3">{r.items.map((it, k) => (
                    <div key={k}>{it.className}{it.discount > 0 && <span className="ml-1 text-xs text-emerald-700">(giảm {money(it.discount)})</span>}</div>
                  ))}</td>
                  <td className="whitespace-nowrap border-l !border-l-slate-100 px-3 py-3 text-right font-semibold tabular-nums">{money(r.total)}</td>
                  <td className="hidden px-3 py-3 text-xs text-slate-600 2xl:table-cell">
                    {r.payments.length === 0 ? <span className="text-slate-400">Chưa thu</span> : [...r.payments].reverse().map((p) => (
                      <div key={p.id} className="whitespace-nowrap">{fmtDate(p.paidAt)} · {money(p.amount)} · {p.method === "CASH" ? "tiền mặt" : "chuyển khoản"}</div>
                    ))}
                  </td>
                  <td className="whitespace-nowrap bg-emerald-50/30 px-3 py-3 text-right tabular-nums text-emerald-700">{money(r.paid)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.lastPaid ? fmtDate(r.lastPaid) : <span className="text-slate-300">—</span>}</td>
                  <td className="whitespace-nowrap border-l !border-l-slate-100 px-4 py-3 text-right font-bold tabular-nums">
                    {r.remain > 0 ? <span className={clsx("text-rose-600")}>{money(r.remain)}</span> : <span className="badge bg-green-50 text-green-700">Đã đủ</span>}
                  </td>
                  <td className="px-2 py-3"><Link href={`${BASE}/${r.id}`} aria-label="Xem chi tiết học phí" title="Xem chi tiết" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-acc-700"><ChevronRight size={18} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Thu tiền mới làm ở màn <Link href="/hoc-phi" className="underline">Học phí</Link> bên Lớp học; phiếu thu tự sang sổ quỹ / ngân hàng. Bấm tên học viên để xem chi tiết và chứng từ liên quan.</p>
    </>
  );
}
