import Link from "next/link";
import { CircleCheck, HandCoins, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard } from "@/components/accounting/ui";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { byClass, loadInvoices } from "@/lib/tuition/summary";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";

export const metadata = { title: "Học phí" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await guardPage("tuition.view");
  const [invoices, classes, payments] = await Promise.all([
    loadInvoices(),
    db.class.findMany({ include: { course: { include: { program: true } } }, orderBy: [{ status: "asc" }, { startDate: "desc" }] }),
    db.payment.findMany({ where: { voidedAt: null }, include: { invoice: { include: { student: true } } }, orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }], take: 12 }),
  ]);
  const per = byClass(invoices);
  const due = invoices.reduce((s, i) => s + i.total, 0);
  const paid = invoices.reduce((s, i) => s + i.paid, 0);

  return (
    <>
      <PageHeader title="Học phí" subtitle="Học phí theo khóa: chốt khi khai giảng, cho đóng 1 lần hoặc nhiều đợt" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard tone="indigo" icon={<Receipt size={20} />} label="Tổng học phí phải thu" value={money(due)} hint={`${invoices.length} phiếu học phí`} />
        <StatCard tone="emerald" icon={<CircleCheck size={20} />} label="Đã thu" value={money(paid)} hint={`${due ? Math.round((paid / due) * 100) : 0}% học phí`} />
        <StatCard tone="rose" icon={<HandCoins size={20} />} label="Còn phải thu" value={money(due - paid)} hint={<Link href="/cong-no" className="underline">Xem danh sách còn nợ</Link>} />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="card overflow-hidden xl:col-span-3">
          <h2 className="px-5 pt-5 text-lg font-bold">Theo lớp</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-2.5">Lớp</th><th className="px-3 py-2.5 text-right">Học viên</th><th className="px-3 py-2.5 text-right">Phải thu</th><th className="px-3 py-2.5">Đã thu</th><th className="px-5 py-2.5 text-right">Còn nợ</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((c) => {
                  const v = per.get(c.id);
                  if (!v) return null;
                  const pct = v.due ? Math.round((v.paid / v.due) * 100) : 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.name}</div>
                        <div className="text-xs text-slate-500">{money(c.unitPrice)} / {c.feeMode === "PER_SESSION" ? "buổi" : "khóa"}{c.status === "ENDED" ? " · đã kết thúc" : ""}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right">{v.students.size}{v.debtors.size ? <div className="text-xs text-rose-600">{v.debtors.size} còn nợ</div> : null}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(v.due)}</td>
                      <td className="px-3 py-2.5">
                        <div className="text-xs text-slate-600">{money(v.paid)} · {pct}%</div>
                        <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right font-bold">{v.due - v.paid > 0 ? <span className="text-rose-600">{money(v.due - v.paid)}</span> : <span className="badge bg-green-50 text-green-700">Đủ</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5 xl:col-span-2">
          <h2 className="mb-3 text-lg font-bold">Lần thu gần đây</h2>
          <div className="divide-y divide-slate-100">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <Link href={`/hoc-sinh/${p.invoice.student.code}`} className="font-semibold hover:underline">{p.invoice.student.fullName}</Link>
                  <div className="text-xs text-slate-500">{fmtDate(p.paidAt)} · {p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}{p.note ? ` · ${p.note}` : ""}</div>
                </div>
                <b className="whitespace-nowrap text-emerald-700">+{money(p.amount)}</b>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">Nút thu tiền, biên nhận VietQR gửi Zalo sẽ có ở giai đoạn 4.</p>
        </section>
      </div>
    </>
  );
}
