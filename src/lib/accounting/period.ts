import { addDays, fmtDate, mondayOf, monthOf, monthRange, shiftMonth, todayVN } from "@/lib/dates";

export type PeriodSP = { ky?: string; thang?: string; tu?: string; den?: string };
export type Period = { key: string; from: string; to: string; label: string; month?: string };

/** Các mốc thời gian nhanh. `thang` dùng cho nút ‹ › chuyển tháng. */
export const PRESETS: { key: string; label: string }[] = [
  { key: "homnay", label: "Hôm nay" },
  { key: "7ngay", label: "7 ngày" },
  { key: "tuan", label: "Tuần này" },
  { key: "thang", label: "Tháng này" },
  { key: "thang-truoc", label: "Tháng trước" },
  { key: "quy", label: "Quý này" },
  { key: "nam", label: "Năm nay" },
];

const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isMonth = (v?: string) => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Khoảng thời gian đang xem, đọc từ ?ky=…&thang=…&tu=…&den=….
 * `defaultKey` là mốc khi chưa chọn gì ("thang" hoặc "tatca").
 */
export function pickPeriod(sp: PeriodSP, opts: { defaultKey?: "thang" | "tatca" } = {}): Period {
  const today = todayVN();
  const cur = monthOf(today);
  const y = Number(today.slice(0, 4));
  const key = sp.ky ?? (isMonth(sp.thang) ? "thang" : opts.defaultKey ?? "thang");
  const month = (m: string): Period => ({ key, ...monthRange(m), label: `Tháng ${m.slice(5)}/${m.slice(0, 4)}`, month: m });
  switch (key) {
    case "tatca": return { key, from: "2000-01-01", to: "2099-12-31", label: "Tất cả thời gian" };
    case "homnay": return { key, from: today, to: today, label: `Hôm nay ${fmtDate(today)}` };
    case "7ngay": { const from = addDays(today, -6); return { key, from, to: today, label: `${fmtDate(from)} – ${fmtDate(today)}` }; }
    case "tuan": { const from = mondayOf(today); const to = addDays(from, 6); return { key, from, to, label: `Tuần ${fmtDate(from)} – ${fmtDate(to)}` }; }
    case "thang-truoc": return { ...month(shiftMonth(cur, -1)), key };
    case "quy": {
      const qs = Math.floor((Number(cur.slice(5)) - 1) / 3) * 3 + 1;
      const from = `${y}-${pad(qs)}-01`;
      return { key, from, to: monthRange(`${y}-${pad(qs + 2)}`).to, label: `Quý ${(qs + 2) / 3}/${y}` };
    }
    case "nam": return { key, from: `${y}-01-01`, to: `${y}-12-31`, label: `Năm ${y}` };
    case "tuychon": {
      let from = isDay(sp.tu) ? sp.tu! : monthRange(cur).from;
      let to = isDay(sp.den) ? sp.den! : today;
      if (from > to) [from, to] = [to, from];
      return { key, from, to, label: `${fmtDate(from)} – ${fmtDate(to)}` };
    }
    default: return { ...month(isMonth(sp.thang) ? sp.thang! : cur), key: "thang" };
  }
}

/** Học phí/hóa đơn tính theo tháng: các tháng nằm trong khoảng ngày. */
export const monthsIn = (p: Period) => ({ from: p.from.slice(0, 7), to: p.to.slice(0, 7) });
