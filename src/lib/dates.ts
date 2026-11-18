// Ngày học là "ngày lịch" (không giờ). Lưu dạng DATE trong Postgres, xử lý ở JS bằng chuỗi "yyyy-MM-dd"
// và Date UTC lúc 00:00 để tránh lệch múi giờ.
export const TZ = "Asia/Ho_Chi_Minh";

export function todayVN(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function toDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}

/** 0 = Chủ nhật … 6 = Thứ Bảy */
export function weekday(day: string): number {
  return toDate(day).getUTCDay();
}

/** Thứ Hai của tuần chứa ngày `day`. */
export function mondayOf(day: string): string {
  return addDays(day, -((weekday(day) + 6) % 7));
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, offset: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toISOString().slice(0, 7);
}

export const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const WEEKDAY_LONG = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function fmtDate(day: string | Date | null | undefined): string {
  if (!day) return "";
  const s = typeof day === "string" ? day : toDay(day);
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}
