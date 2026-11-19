import Link from "next/link";
import clsx from "clsx";
import { CalendarClock, ChevronLeft, ChevronRight, HandCoins, Search, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { FilterForm, FilterSelect } from "@/components/classes/filter-form";
import { CollectButton, ExcelLink, RingStat } from "@/components/tuition/ui";
import { ShareReminder } from "@/components/tuition/client";
import { Avatar } from "@/app/(lop-hoc)/lop-hoc/[code]/students-tab";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getBrand } from "@/lib/settings";
import { monthOf, todayVN } from "@/lib/dates";
import { money } from "@/lib/money";
import { debtRows, filterSheets, monthShort, tuitionSheets, type DebtRow } from "@/lib/tuition/month";

export const metadata = { title: "Công nợ" };
export const dynamic = "force-dynamic";

const PER_PAGE = 12;

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; lop?: string; trang?: string }> }) {
  const user = await guardPage("tuition.view");
  const sp = await searchParams;
  const current = monthOf(todayVN());
  const [sheets, classes, accounts, brand] = await Promise.all([
    tuitionSheets(),
    db.class.findMany({ select: { code: true, name: true }, orderBy: [{ status: "asc" }, { name: "asc" }] }),
    db.cashAccount.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, name: true, kind: true } }),
    getBrand(),
  ]);
  const canCollect = can(user.role, "tuition.collect");

  const all = debtRows(sheets, current);
  const total = all.reduce((s, r) => s + r.total, 0);
  const overdue = all.reduce((s, r) => s + r.overdue, 0);
  const overdueCount = all.filter((r) => r.overdue > 0).length;
  const thisMonth = sheets.filter((s) => s.month === current);
  const thisRemain = thisMonth.reduce((s, x) => s + x.remain, 0);
  const thisTotal = thisMonth.reduce((s, x) => s + x.total, 0);

  const rows = debtRows(filterSheets(sheets, { q: sp.q, lop: sp.lop }), current);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.trang) || 1));
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const href = (n: number) => { const p = new URLSearchParams(); if (sp.q) p.set("q", sp.q); if (sp.lop) p.set("lop", sp.lop); if (n > 1) p.set("trang", String(n)); const s = p.toString(); return s ? `/cong-no?${s}` : "/cong-no"; };
  const usedClasses = new Set(all.flatMap((r) => r.sheets.flatMap((s) => s.items.filter((i) => i.remain > 0).map((i) => i.classCode))));

  return (
    <>
      <PageHeader title="Công nợ học phí" subtitle={`Các tháng học viên còn chưa đóng đủ học phí, tính đến tháng ${Number(current.slice(5))}/${current.slice(0, 4)}`}
        actions={<ExcelLink href="/cong-no/xuat" />} />

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <RingStat icon={<HandCoins size={15} className="text-rose-600" />} label="Tổng công nợ" value={money(total)} color="#ef4444" pct={100} ring={`${all.length} HV`} hint={`${all.length} học viên còn nợ`} />
        <RingStat icon={<TriangleAlert size={15} className="text-amber-500" />} label="Nợ các tháng trước" value={money(overdue)} color="#f59e0b" pct={total ? (overdue / total) * 100 : 0} hint={`${overdueCount} học viên nợ quá hạn`} />
        <RingStat icon={<CalendarClock size={15} className="text-brand-600" />} label={`Chưa thu ${monthShort(current)}`} value={money(thisRemain)} color="#2563eb" pct={thisTotal ? (thisRemain / thisTotal) * 100 : 0} hint="Tháng đang học" />
      </div>

      <section className="card overflow-hidden">
        <FilterForm action="/cong-no" resetHref="/cong-no" active={!!(sp.q || sp.lop)} className="grid grid-cols-2 gap-3 border-b border-slate-100 p-3 md:grid-cols-12">
          <label className="col-span-2 block md:col-span-7">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Tìm kiếm</span>
            <span className="relative block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={sp.q} placeholder="Tìm học viên, phụ huynh, số điện thoại…" className="input w-full" style={{ paddingLeft: 36 }} /></span>
          </label>
          <div className="md:col-span-3"><FilterSelect label="Lớp" name="lop" value={sp.lop}><option value="">Tất cả lớp</option>{classes.filter((c) => usedClasses.has(c.code)).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</FilterSelect></div>
        </FilterForm>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="text-left text-xs font-semibold text-slate-500">
              <tr className="border-b border-slate-100"><th className="px-4 py-3">Học viên</th><th className="px-3 py-3">Phụ huynh / liên hệ</th><th className="px-3 py-3">Chi tiết nợ</th><th className="px-3 py-3 text-right">Tổng nợ</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Không có học viên nào còn nợ.</td></tr>}
              {shown.map((r) => (
                <tr key={r.student.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.student.fullName} color={r.overdue ? "#e11d48" : "#2563eb"} />
                      <div><Link href={`/hoc-sinh/${r.student.code}`} className="font-semibold hover:underline">{r.student.fullName}</Link>
                        <div className="text-xs text-slate-500">{r.student.code} · {r.sheets.length} tháng</div></div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{r.student.parentName ? `${r.student.parentName}${r.student.parentRelation ? ` (${r.student.parentRelation})` : ""}` : <span className="text-slate-500">Học viên tự đóng</span>}</div>
                    {r.student.parentPhone && <a href={`tel:${r.student.parentPhone}`} className="block text-xs text-slate-500 hover:text-brand-600 hover:underline">PH {r.student.parentPhone}</a>}
                    {r.student.phone && <a href={`tel:${r.student.phone}`} className="block text-xs text-slate-500 hover:text-brand-600 hover:underline">HV {r.student.phone}</a>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.sheets.flatMap((s) => s.items.filter((i) => i.remain > 0).map((i) => (
                      <div key={i.key} className="flex items-baseline justify-between gap-4 py-0.5 text-[13px]">
                        <span className={clsx(s.month < current ? "text-slate-700" : "text-slate-600")}>
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: i.color }} />
                          <b className={s.month < current ? "text-amber-600" : ""}>{monthShort(s.month)}</b> · {i.className}{i.paid ? <span className="text-slate-400"> (đã thu {money(i.paid)})</span> : null}{i.locked ? null : <span className="text-slate-400"> · chưa chốt</span>}
                        </span>
                        <span className="whitespace-nowrap font-semibold">{money(i.remain)}</span>
                      </div>
                    )))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-base font-extrabold text-rose-600">{money(r.total)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {canCollect && r.sheets.map((s) => <CollectButton key={s.key} sheet={s} accounts={accounts} label={monthShort(s.month)} className="px-2.5" />)}
                      <ShareReminder text={reminder(r, brand.centerName)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>Hiển thị {rows.length ? (page - 1) * PER_PAGE + 1 : 0}–{Math.min(page * PER_PAGE, rows.length)} / {rows.length}</span>
          {pages > 1 && (
            <nav className="flex items-center gap-1">
              <PageLink href={href(page - 1)} disabled={page === 1} label={<ChevronLeft size={16} />} />
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <PageLink key={n} href={href(n)} active={n === page} label={n} />)}
              <PageLink href={href(page + 1)} disabled={page === pages} label={<ChevronRight size={16} />} />
            </nav>
          )}
        </div>
      </section>
    </>
  );
}

function PageLink({ href, label, active, disabled }: { href: string; label: React.ReactNode; active?: boolean; disabled?: boolean }) {
  if (disabled) return <span className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300">{label}</span>;
  return <Link href={href} className={clsx("flex h-9 w-9 items-center justify-center rounded-lg font-semibold", active ? "bg-brand-600 text-white" : "ring-1 ring-slate-200 hover:bg-slate-50")}>{label}</Link>;
}

function reminder(r: DebtRow, center: string) {
  const who = r.student.parentName ? `Kính gửi ${r.student.parentRelation ? `${r.student.parentRelation} ` : ""}${r.student.parentName}` : `Chào ${r.student.fullName}`;
  const lines = r.sheets.flatMap((s) => s.items.filter((i) => i.remain > 0).map((i) => `- ${monthShort(s.month)} · ${i.className}: ${money(i.remain)}`));
  return `${who},\n${center} xin thông báo học phí còn chưa đóng của học viên ${r.student.fullName} (${r.student.code}):\n${lines.join("\n")}\nTổng cộng: ${money(r.total)}.\nMong gia đình sắp xếp đóng sớm. Xin cảm ơn!`;
}
