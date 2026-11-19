import Link from "next/link";
import clsx from "clsx";
import { Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { loadInvoices } from "@/lib/tuition/summary";
import { fmtDate, todayVN, toDate } from "@/lib/dates";
import { money } from "@/lib/money";

export const metadata = { title: "Công nợ" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ ct?: string }> }) {
  await guardPage("tuition.view");
  const { ct } = await searchParams;
  const [invoices, programs, classes] = await Promise.all([
    loadInvoices(),
    db.program.findMany({ orderBy: { order: "asc" } }),
    db.class.findMany({ include: { course: { include: { program: true } } } }),
  ]);
  const programOf = (classId: string) => classes.find((c) => c.id === classId)?.course?.program.code;
  const today = toDate(todayVN()).getTime();
  const rows = invoices
    .filter((i) => i.remain > 0 && (!ct || i.items.some((it) => programOf(it.classId) === ct)))
    .map((i) => ({ ...i, days: Math.floor((today - (i.lockedAt ?? i.createdAt).getTime()) / 86_400_000) }))
    .sort((a, b) => b.days - a.days || b.remain - a.remain);
  const total = rows.reduce((s, r) => s + r.remain, 0);

  return (
    <>
      <PageHeader title="Công nợ học phí" subtitle={`${rows.length} học viên còn nợ · tổng ${money(total)}`} />
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Chip href="/cong-no" active={!ct}>Tất cả</Chip>
        {programs.map((p) => <Chip key={p.id} href={`/cong-no?ct=${p.code}`} active={ct === p.code} color={p.color}>{p.name}</Chip>)}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Học viên</th><th className="px-3 py-3">Liên hệ</th><th className="px-3 py-3">Lớp</th><th className="px-3 py-3 text-right">Phải thu</th><th className="px-3 py-3 text-right">Đã đóng</th><th className="px-3 py-3 text-right">Còn nợ</th><th className="px-4 py-3 text-right">Đã chốt</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Không có học viên nào còn nợ.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5"><Link href={`/hoc-sinh/${r.student.code}`} className="font-semibold hover:underline">{r.student.fullName}</Link><div className="text-xs text-slate-500">{r.student.code} · chốt {fmtDate(r.lockedAt)}</div></td>
                  <td className="px-3 py-2.5">
                    <div className="text-slate-700">{r.student.parentName ?? "Học viên"}</div>
                    {r.student.parentPhone && <a href={`tel:${r.student.parentPhone}`} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"><Phone size={12} />{r.student.parentPhone}</a>}
                  </td>
                  <td className="px-3 py-2.5">{r.items.map((it) => <div key={it.classId}>{it.className}</div>)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(r.total)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-emerald-700">{r.paid ? money(r.paid) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-rose-600">{money(r.remain)}</td>
                  <td className="px-4 py-2.5 text-right"><span className={clsx("badge", r.days > 30 ? "bg-rose-50 text-rose-700" : r.days > 14 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>{r.days} ngày</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Đỏ: quá 30 ngày kể từ ngày chốt học phí. Gửi nhắc nợ qua Zalo sẽ có ở giai đoạn 4.</p>
    </>
  );
}

function Chip({ href, active, color, children }: { href: string; active: boolean; color?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={clsx("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium ring-1 transition",
      active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50")}>
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </Link>
  );
}
