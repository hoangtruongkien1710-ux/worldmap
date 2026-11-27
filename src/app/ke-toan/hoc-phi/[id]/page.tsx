import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard, VoucherBadge } from "@/components/accounting/ui";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { fmtDate, toDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { CircleCheck, HandCoins, Receipt } from "lucide-react";

export const metadata = { title: "Chi tiết học phí" };
export const dynamic = "force-dynamic";

type Item = { classId: string; className: string; gross: number; discount: number; amount: number; note?: string };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await guardPage("accounting.view");
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { student: { include: { grade: true } }, payments: { orderBy: { paidAt: "desc" } } } });
  if (!inv) notFound();
  const items = (inv.lockedDetail ?? []) as Item[];
  const [classes, txns] = await Promise.all([
    db.class.findMany({ where: { id: { in: items.map((i) => i.classId) } }, select: { id: true, code: true } }),
    db.cashTxn.findMany({ where: { paymentId: { in: inv.payments.map((p) => p.id) } }, include: { account: true } }),
  ]);
  const total = inv.lockedAmount ?? 0;
  const active = inv.payments.filter((p) => !p.voidedAt);
  const paid = active.reduce((s, p) => s + p.amount, 0);
  const remain = total - paid;
  const s = inv.student;
  const canClass = can(user.role, "class.view");
  return (
    <>
      <Link href="/ke-toan/hoc-phi" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> Học phí & thu khác</Link>
      <PageHeader title={s.fullName} subtitle={`${s.code} · học phí tháng ${inv.month.slice(5)}/${inv.month.slice(0, 4)}${s.parentPhone || s.phone ? ` · ${s.parentPhone ?? s.phone}` : ""}`}
        actions={can(user.role, "student.view") && <Link href={`/hoc-sinh/${s.code}`} className="btn"><ExternalLink size={15} /> Hồ sơ học viên</Link>} />
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard tone="indigo" icon={<Receipt size={20} />} label="Phải thu" value={money(total)} hint={`${items.length} lớp`} />
        <StatCard tone="emerald" icon={<CircleCheck size={20} />} label="Đã thu" value={money(paid)} hint={`${active.length} lần thu`} />
        <StatCard tone={remain > 0 ? "rose" : "emerald"} icon={<HandCoins size={20} />} label="Còn lại" value={remain > 0 ? money(remain) : "Đã đóng đủ"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card overflow-hidden lg:col-span-2">
          <h2 className="px-5 pt-5 text-lg font-bold">Học phí theo lớp</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-2.5">Lớp</th><th className="px-3 py-2.5 text-right">Học phí</th><th className="px-5 py-2.5 text-right">Phải thu</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => {
                const code = classes.find((c) => c.id === it.classId)?.code;
                return (
                  <tr key={it.classId}>
                    <td className="px-5 py-2.5">{code && canClass ? <Link href={`/lop-hoc/${code}?tab=hoc-phi`} className="font-semibold hover:text-acc-700 hover:underline">{it.className}</Link> : <b>{it.className}</b>}{it.note && <div className="text-xs text-slate-500">{it.note}</div>}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{money(it.gross)}{it.discount > 0 && <div className="text-xs text-emerald-700">giảm {money(it.discount)}</div>}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right font-semibold tabular-nums">{money(it.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="card overflow-hidden lg:col-span-3">
          <h2 className="px-5 pt-5 text-lg font-bold">Các lần thu & chứng từ</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[520px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-2.5">Ngày thu</th><th className="px-3 py-2.5">Hình thức</th><th className="px-3 py-2.5">Chứng từ</th><th className="px-5 py-2.5 text-right">Số tiền</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {inv.payments.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">Chưa thu đồng nào.</td></tr>}
                {inv.payments.map((p) => {
                  const t = txns.find((x) => x.paymentId === p.id);
                  const book = t ? (t.account.kind === "BANK" ? `/ke-toan/ngan-hang?tk=${t.account.code}` : "/ke-toan/quy") : null;
                  return (
                    <tr key={p.id} className={p.voidedAt ? "text-slate-400 line-through" : ""}>
                      <td className="whitespace-nowrap px-5 py-2.5">{fmtDate(p.paidAt)}</td>
                      <td className="px-3 py-2.5">{p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}{p.note && <div className="text-xs text-slate-500">{p.note}</div>}</td>
                      <td className="px-3 py-2.5">
                        {t && book ? (
                          <Link href={`${book}${book.includes("?") ? "&" : "?"}ky=tuychon&tu=${toDay(t.date)}&den=${toDay(t.date)}`} className="no-underline">
                            <span className="font-semibold text-acc-700 hover:underline">{t.code}</span> <VoucherBadge code={t.code} /> <span className="text-xs text-slate-500">{t.account.name}</span>
                          </Link>
                        ) : <span className="text-slate-400">—</span>}
                        {p.voidedAt && <span className="ml-2 badge bg-rose-50 text-rose-700 no-underline">Đã hủy</span>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right font-semibold tabular-nums">{money(p.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
