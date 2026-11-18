import { PageHeader } from "@/components/layout/app-shell";
import { MonthNav, monthLabel } from "@/components/accounting/ui";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { ledgerSums, pickMonth, prevDay } from "@/lib/accounting/queries";
import { monthRange } from "@/lib/dates";
import { money } from "@/lib/money";

export const metadata = { title: "Tổng hợp" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ thang?: string }> }) {
  await guardPage("accounting.view");
  const month = pickMonth((await searchParams).thang);
  const { from, to } = monthRange(month);
  const [accounts, before, during] = await Promise.all([
    db.ledgerAccount.findMany({ orderBy: { code: "asc" } }),
    ledgerSums(null, prevDay(from)),
    ledgerSums(from, to),
  ]);
  const z = { debit: 0, credit: 0 };
  // Chỉ hiện tài khoản chi tiết (không có tài khoản con) và có số liệu.
  const leaves = accounts.filter((a) => !accounts.some((c) => c.parentCode === a.code));
  const rows = leaves.map((a) => {
    const o = before.get(a.code) ?? z;
    const p = during.get(a.code) ?? z;
    const open = o.debit - o.credit;
    const close = open + p.debit - p.credit;
    return { ...a, open, pDebit: p.debit, pCredit: p.credit, close };
  }).filter((r) => r.open || r.pDebit || r.pCredit || r.close);
  const tot = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const side = (v: number, want: "D" | "C") => (want === "D" ? (v > 0 ? money(v) : "") : v < 0 ? money(-v) : "");
  const balanced = tot((r) => r.pDebit) === tot((r) => r.pCredit) && tot((r) => r.close) === 0;

  return (
    <>
      <PageHeader title="Bảng cân đối số phát sinh" subtitle={`${monthLabel(month)} · lấy từ sổ nhật ký chung (bút toán kép)`} actions={<MonthNav month={month} base="/ke-toan/tong-hop" />} />
      <div className={`mb-4 inline-flex rounded-xl px-3 py-1.5 text-sm font-semibold ${balanced ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"}`}>
        {balanced ? "Sổ cân: tổng Nợ = tổng Có" : "Sổ lệch, cần kiểm tra"}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th rowSpan={2} className="px-4 py-2 text-left">TK</th><th rowSpan={2} className="px-3 py-2 text-left">Tên tài khoản</th>
                <th colSpan={2} className="px-3 py-2">Số dư đầu kỳ</th><th colSpan={2} className="px-3 py-2">Phát sinh trong kỳ</th><th colSpan={2} className="px-4 py-2">Số dư cuối kỳ</th>
              </tr>
              <tr>{["Nợ", "Có", "Nợ", "Có", "Nợ", "Có"].map((h, i) => <th key={i} className="px-3 py-1.5 text-right">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.code} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-bold">{r.code}</td>
                  <td className="px-3 py-2.5">{r.name}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{side(r.open, "D")}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{side(r.open, "C")}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-sky-700">{r.pDebit ? money(r.pDebit) : ""}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-orange-700">{r.pCredit ? money(r.pCredit) : ""}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{side(r.close, "D")}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">{side(r.close, "C")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 font-bold">
              <tr>
                <td className="px-4 py-3" colSpan={2}>Cộng</td>
                <td className="px-3 py-3 text-right">{money(tot((r) => Math.max(0, r.open)))}</td>
                <td className="px-3 py-3 text-right">{money(tot((r) => Math.max(0, -r.open)))}</td>
                <td className="px-3 py-3 text-right">{money(tot((r) => r.pDebit))}</td>
                <td className="px-3 py-3 text-right">{money(tot((r) => r.pCredit))}</td>
                <td className="px-3 py-3 text-right">{money(tot((r) => Math.max(0, r.close)))}</td>
                <td className="px-4 py-3 text-right">{money(tot((r) => Math.max(0, -r.close)))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Chưa kết chuyển cuối kỳ sang TK 911; doanh thu, chi phí đang để lũy kế từ 01/09/2026.</p>
    </>
  );
}
