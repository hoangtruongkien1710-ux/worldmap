import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Tone } from "@/components/layout/nav";
import { TONE } from "@/components/ui/tone";
import { fmtDate, shiftMonth } from "@/lib/dates";
import { money } from "@/lib/money";
import { SortTh } from "@/components/ui/sort-th";
import type { SortState } from "@/lib/sort";
import { orderBook } from "@/lib/accounting/book-sort";

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

export type BookRow = {
  id: string; code: string; date: string; description: string; counterparty: string | null; label: string;
  linked?: string | null; link?: { href: string; label: string } | null;
  kind: "IN" | "OUT" | "TRANSFER"; categoryId: number | null; supplierId: string | null;
  in: number; out: number; balance: number;
};

/** Dải số liệu tổng đầu bảng: nhãn nhỏ, số lớn, màu theo ý nghĩa. */
export function SummaryStrip({ items }: { items: { label: string; value: React.ReactNode; tone?: "emerald" | "rose" | "slate" | "sky"; hint?: React.ReactNode }[] }) {
  const C = { emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-700", rose: "border-rose-200 bg-rose-50/60 text-rose-700", sky: "border-sky-200 bg-sky-50/60 text-sky-700", slate: "border-slate-200 bg-white text-slate-800" };
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className={`rounded-xl border px-4 py-3 ${C[i.tone ?? "slate"]}`}>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{i.label}</div>
          <div className="mt-0.5 text-base font-extrabold tabular-nums sm:text-xl">{i.value}</div>
          {i.hint && <div className="text-xs opacity-70">{i.hint}</div>}
        </div>
      ))}
    </div>
  );
}

/** Bảng sổ quỹ / sổ tiền gửi: mới nhất trước, bấm tiêu đề cột để sắp xếp, có liên kết sang học phí / lương / hóa đơn. */
export function CashBookTable({ opening, rows, totalIn, totalOut, closing, action, base, params, sort }: {
  opening: number; rows: BookRow[]; totalIn: number; totalOut: number; closing: number; action?: (r: BookRow) => React.ReactNode;
  base: string; params: Record<string, string | undefined>; sort: SortState;
}) {
  const shown = orderBook(rows, sort);
  const th = (col: string, label: string, align?: "right") => <SortTh col={col} label={label} base={base} params={params} sort={sort} align={align} className="px-3 py-3" />;
  return (
    <>
      <SummaryStrip items={[
        { label: "Tồn đầu kỳ", value: money(opening) },
        { label: "Tổng thu", value: money(totalIn), tone: "emerald", hint: `${rows.filter((r) => r.in).length} chứng từ` },
        { label: "Tổng chi", value: money(totalOut), tone: "rose", hint: `${rows.filter((r) => r.out).length} chứng từ` },
        { label: "Tồn cuối kỳ", value: money(closing), tone: "sky" },
      ]} />
      <div className="card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs">
              <tr className="[&>th]:border-b [&>th]:border-slate-200">
                {th("ngay", "Ngày")}{th("so", "Số chứng từ")}{th("dg", "Diễn giải")}
                {th("thu", "Thu", "right")}{th("chi", "Chi", "right")}{th("ton", "Tồn", "right")}{action && <th className="w-12" />}
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-slate-50/50 [&>tr>td]:border-b [&>tr>td]:border-slate-100">
              {shown.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Không có chứng từ trong khoảng thời gian này.</td></tr>}
              {shown.map((r) => (
                <tr key={r.id} className="hover:bg-acc-50/40">
                  <td className="whitespace-nowrap px-4 py-2.5 align-top text-slate-600">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2.5 align-top">
                    {r.link ? <Link href={r.link.href} className="font-semibold text-acc-700 hover:underline">{r.code}</Link> : <div className="font-semibold">{r.code}</div>}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5"><VoucherBadge code={r.code} />{r.link && <Link href={r.link.href} className="text-xs font-semibold text-acc-700 hover:underline">{r.link.label} →</Link>}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div>{r.description}</div>
                    <div className="text-xs text-slate-500">{[r.label, r.counterparty].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="whitespace-nowrap border-l !border-l-slate-100 bg-emerald-50/30 px-3 py-2.5 text-right align-top font-semibold tabular-nums text-emerald-700">{r.in ? money(r.in) : <span className="text-slate-300">—</span>}</td>
                  <td className="whitespace-nowrap bg-rose-50/30 px-3 py-2.5 text-right align-top font-semibold tabular-nums text-rose-600">{r.out ? money(r.out) : <span className="text-slate-300">—</span>}</td>
                  <td className="whitespace-nowrap border-l !border-l-slate-100 px-4 py-2.5 text-right align-top font-bold tabular-nums">{money(r.balance)}</td>
                  {action && <td className="px-2 py-2.5 text-right align-top">{action(r)}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-slate-50 font-bold [&>tr>td]:border-t-2 [&>tr>td]:border-slate-200">
              <tr>
                <td className="px-4 py-3" colSpan={3}>Cộng phát sinh trong kỳ</td>
                <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{money(totalIn)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-rose-600">{money(totalOut)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(closing)}</td>{action && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
