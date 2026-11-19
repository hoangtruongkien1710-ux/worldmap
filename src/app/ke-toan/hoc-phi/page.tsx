import Link from "next/link";
import { CircleCheck, HandCoins, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard, Tabs } from "@/components/accounting/ui";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";

export const metadata = { title: "Học phí & thu khác" };
export const dynamic = "force-dynamic";

type Item = { className: string; amount: number; discount: number; note?: string };

export default async function Page({ searchParams }: { searchParams: Promise<{ tt?: string }> }) {
  await guardPage("accounting.view");
  const filter = (await searchParams).tt === "con-no" ? "debt" : (await searchParams).tt === "da-du" ? "paid" : "all";
  const invoices = await db.invoice.findMany({
    include: { student: true, payments: { where: { voidedAt: null }, orderBy: { paidAt: "asc" } } },
    orderBy: [{ month: "desc" }, { createdAt: "asc" }],
  });
  const rows = invoices.map((i) => {
    const total = i.lockedAmount ?? 0;
    const paid = i.payments.reduce((s, p) => s + p.amount, 0);
    return { ...i, total, paid, remain: total - paid, items: (i.lockedDetail ?? []) as Item[] };
  });
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const shown = rows
    .filter((r) => (filter === "debt" ? r.remain > 0 : filter === "paid" ? r.remain <= 0 : true))
    .sort((a, b) => (filter === "debt" ? b.remain - a.remain : 0));

  return (
    <>
      <PageHeader title="Học phí & thu khác" subtitle="Học phí ghi nhận khi khai giảng; thu tiền mặt hoặc chuyển khoản theo từng đợt" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard tone="indigo" icon={<Receipt size={20} />} label="Học phí đã ghi nhận" value={money(sum((r) => r.total))} hint={`${rows.length} phiếu báo học phí`} />
        <StatCard tone="emerald" icon={<CircleCheck size={20} />} label="Đã thu" value={money(sum((r) => r.paid))} hint={`${rows.filter((r) => r.remain <= 0).length} học viên đã đóng đủ`} />
        <StatCard tone="rose" icon={<HandCoins size={20} />} label="Còn phải thu" value={money(sum((r) => Math.max(0, r.remain)))} hint={`${rows.filter((r) => r.remain > 0).length} học viên còn nợ`} />
      </div>
      <div className="mb-4">
        <Tabs items={[
          { href: "/ke-toan/hoc-phi", label: "Tất cả", active: filter === "all" },
          { href: "/ke-toan/hoc-phi?tt=con-no", label: "Còn nợ", active: filter === "debt" },
          { href: "/ke-toan/hoc-phi?tt=da-du", label: "Đã đóng đủ", active: filter === "paid" },
        ]} />
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Học viên</th><th className="px-3 py-3">Lớp / khóa</th><th className="px-3 py-3 text-right">Phải thu</th><th className="px-3 py-3">Các lần thu</th><th className="px-3 py-3 text-right">Đã thu</th><th className="px-4 py-3 text-right">Còn nợ</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => (
                <tr key={r.id} className="align-top hover:bg-slate-50/60">
                  <td className="px-4 py-3"><div className="font-semibold">{r.student.fullName}</div><div className="text-xs text-slate-500">{r.student.code} · {r.student.parentPhone ?? r.student.phone ?? ""}</div></td>
                  <td className="px-3 py-3">{r.items.map((it, k) => (
                    <div key={k}>{it.className}{it.discount > 0 && <span className="ml-1 text-xs text-emerald-700">(giảm {money(it.discount)})</span>}</div>
                  ))}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{money(r.total)}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {r.payments.length === 0 ? <span className="text-slate-400">Chưa thu</span> : r.payments.map((p) => (
                      <div key={p.id} className="whitespace-nowrap">{fmtDate(p.paidAt)} · {money(p.amount)} · {p.method === "CASH" ? "tiền mặt" : "chuyển khoản"}</div>
                    ))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-emerald-700">{money(r.paid)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold">{r.remain > 0 ? <span className="text-rose-600">{money(r.remain)}</span> : <span className="badge bg-green-50 text-green-700">Đã đủ</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Thu tiền mới làm ở màn <Link href="/hoc-phi" className="underline">Học phí</Link> bên Lớp học (giai đoạn 4); phiếu thu tự sang sổ quỹ / ngân hàng.</p>
    </>
  );
}
