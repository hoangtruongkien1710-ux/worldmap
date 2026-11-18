import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Tone } from "@/components/layout/nav";
import { TONE } from "@/components/ui/tone";
import { fmtDate, shiftMonth } from "@/lib/dates";
import { money } from "@/lib/money";

export const monthLabel = (m: string) => `Tháng ${m.slice(5)}/${m.slice(0, 4)}`;

/** Chọn tháng: ‹ Tháng 11/2026 › — giữ nguyên các tham số khác của trang. */
export function MonthNav({ month, base, params = {} }: { month: string; base: string; params?: Record<string, string | undefined> }) {
  const href = (m: string) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
    u.set("thang", m);
    return `${base}?${u}`;
  };
  return (
    <div className="inline-flex items-center rounded-xl bg-white ring-1 ring-slate-200">
      <Link href={href(shiftMonth(month, -1))} className="rounded-l-xl p-2 text-slate-500 hover:bg-slate-50" aria-label="Tháng trước"><ChevronLeft size={18} /></Link>
      <span className="min-w-32 px-2 text-center text-sm font-semibold">{monthLabel(month)}</span>
      <Link href={href(shiftMonth(month, 1))} className="rounded-r-xl p-2 text-slate-500 hover:bg-slate-50" aria-label="Tháng sau"><ChevronRight size={18} /></Link>
    </div>
  );
}

export function StatCard({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: React.ReactNode; tone: Tone }) {
  const t = TONE[tone];
  return (
    <div className="card flex items-start gap-3.5 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-4 ${t.tile} ${t.text} ${t.ring}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[13px] leading-tight text-slate-500">{label}</div>
        <div className="mt-0.5 truncate text-xl font-extrabold">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

export function Tabs({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={clsx("rounded-xl px-4 py-2 text-sm font-semibold transition",
          i.active ? "bg-acc-600 text-white shadow-md shadow-acc-600/25" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export const VOUCHER_LABEL: Record<string, { label: string; cls: string }> = {
  PT: { label: "Phiếu thu", cls: "bg-emerald-50 text-emerald-700" },
  PC: { label: "Phiếu chi", cls: "bg-rose-50 text-rose-700" },
  BC: { label: "Báo có", cls: "bg-sky-50 text-sky-700" },
  BN: { label: "Báo nợ", cls: "bg-orange-50 text-orange-700" },
  CT: { label: "Chuyển tiền", cls: "bg-violet-50 text-violet-700" },
  HP: { label: "Học phí", cls: "bg-indigo-50 text-indigo-700" },
  MH: { label: "Mua hàng", cls: "bg-amber-50 text-amber-700" },
  LUONG: { label: "Lương", cls: "bg-fuchsia-50 text-fuchsia-700" },
  NVK: { label: "Nghiệp vụ khác", cls: "bg-slate-100 text-slate-600" },
};

export function VoucherBadge({ code }: { code: string }) {
  const type = code.match(/^[A-Z]+/)?.[0] ?? "";
  const v = VOUCHER_LABEL[type] ?? VOUCHER_LABEL.NVK;
  return <span className={`badge whitespace-nowrap ${v.cls}`}>{v.label}</span>;
}

type BookRow = { id: string; code: string; date: string; description: string; counterparty: string | null; label: string; in: number; out: number; balance: number };

/** Bảng sổ quỹ / sổ tiền gửi có số dư lũy kế. */
export function CashBookTable({ opening, rows, totalIn, totalOut, closing }: { opening: number; rows: BookRow[]; totalIn: number; totalOut: number; closing: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Ngày</th><th className="px-3 py-3">Số chứng từ</th><th className="px-3 py-3">Diễn giải</th>
              <th className="px-3 py-3 text-right">Thu</th><th className="px-3 py-3 text-right">Chi</th><th className="px-4 py-3 text-right">Tồn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-slate-50/60 font-semibold">
              <td className="px-4 py-2.5" colSpan={5}>Số dư đầu kỳ</td>
              <td className="px-4 py-2.5 text-right">{money(opening)}</td>
            </tr>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Không có chứng từ trong tháng.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{fmtDate(r.date)}</td>
                <td className="px-3 py-2.5"><div className="font-semibold">{r.code}</div><VoucherBadge code={r.code} /></td>
                <td className="px-3 py-2.5">
                  <div>{r.description}</div>
                  <div className="text-xs text-slate-500">{[r.label, r.counterparty].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-emerald-700">{r.in ? money(r.in) : ""}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-rose-600">{r.out ? money(r.out) : ""}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">{money(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 font-bold">
            <tr>
              <td className="px-4 py-3" colSpan={3}>Cộng phát sinh · Số dư cuối kỳ</td>
              <td className="px-3 py-3 text-right text-emerald-700">{money(totalIn)}</td>
              <td className="px-3 py-3 text-right text-rose-600">{money(totalOut)}</td>
              <td className="px-4 py-3 text-right">{money(closing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
