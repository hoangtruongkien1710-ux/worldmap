import Link from "next/link";
import clsx from "clsx";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth } from "@/lib/dates";
import { PRESETS, type Period } from "@/lib/accounting/period";

type Params = Record<string, string | undefined>;

/** Các tham số lọc thời gian / sắp xếp trang khác không được giữ lại khi đổi kỳ. */
const DROP = ["ky", "thang", "tu", "den", "trang"];

export function qs(params: Params, patch: Params = {}) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
}

/**
 * Thanh chọn thời gian cho kế toán: mốc nhanh (hôm nay, tuần, tháng, quý, năm…),
 * nút ‹ › khi xem theo tháng, và khoảng ngày tùy chọn. Giữ nguyên các bộ lọc khác của trang.
 */
export function PeriodBar({ base, period, params = {}, allowAll }: { base: string; period: Period; params?: Params; allowAll?: boolean }) {
  const keep = Object.fromEntries(Object.entries(params).filter(([k]) => !DROP.includes(k)));
  const link = (patch: Params) => `${base}${qs(keep, patch)}`;
  const presets = allowAll ? [{ key: "tatca", label: "Tất cả" }, ...PRESETS] : PRESETS;
  const month = period.key === "thang" ? period.month : undefined;
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((p) => (
          <Link key={p.key} href={link({ ky: p.key })} scroll={false}
            className={clsx("rounded-lg px-3 py-1.5 text-[13px] font-semibold transition",
              period.key === p.key ? "bg-acc-600 text-white shadow-sm" : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100")}>
            {p.label}
          </Link>
        ))}
      </div>
      {month && (
        <div className="inline-flex items-center rounded-lg bg-white ring-1 ring-slate-200">
          <Link href={link({ ky: "thang", thang: shiftMonth(month, -1) })} className="rounded-l-lg p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Tháng trước"><ChevronLeft size={17} /></Link>
          <span className="min-w-28 px-2 text-center text-[13px] font-bold">{period.label}</span>
          <Link href={link({ ky: "thang", thang: shiftMonth(month, 1) })} className="rounded-r-lg p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Tháng sau"><ChevronRight size={17} /></Link>
        </div>
      )}
      <form action={base} className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <input type="hidden" name="ky" value="tuychon" />
        <CalendarRange size={16} className="text-slate-400" />
        <input type="date" name="tu" defaultValue={period.from < "2001-01-01" ? "" : period.from} className="input !w-auto !py-1.5 text-[13px]" aria-label="Từ ngày" />
        <span className="text-slate-400">–</span>
        <input type="date" name="den" defaultValue={period.to > "2098-01-01" ? "" : period.to} className="input !w-auto !py-1.5 text-[13px]" aria-label="Đến ngày" />
        <button type="submit" className={clsx("btn !py-1.5 text-[13px]", period.key === "tuychon" && "border-acc-600 text-acc-700")}>Xem</button>
      </form>
      {period.key !== "thang" && <div className="basis-full text-xs text-slate-500">Đang xem: <b className="text-slate-700">{period.label}</b></div>}
    </div>
  );
}

/** Ô tìm kiếm gửi bằng GET, giữ nguyên thời gian / bộ lọc / sắp xếp đang chọn. */
export function SearchForm({ base, params, placeholder, className }: { base: string; params: Params; placeholder: string; className?: string }) {
  return (
    <form action={base} className={clsx("flex items-center gap-2", className)}>
      {Object.entries(params).map(([k, v]) => k !== "q" && k !== "trang" && v && <input key={k} type="hidden" name={k} value={v} />)}
      <input name="q" defaultValue={params.q} placeholder={placeholder} className="input !w-64 !py-1.5 text-[13px]" />
      <button type="submit" className="btn !py-1.5 text-[13px]">Tìm</button>
      {params.q && <Link href={`${base}${qs(params, { q: undefined })}`} className="text-[13px] font-semibold text-slate-500 hover:text-slate-800">Xóa tìm</Link>}
    </form>
  );
}
