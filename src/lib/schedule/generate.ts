import { addDays, weekday } from "../dates";

export type ScheduleRule = {
  weekday: number; // 0 = CN … 6 = T7
  startTime: string;
  endTime: string;
  validFrom: string; // yyyy-MM-dd
  validTo?: string | null;
};

export type PlannedSession = { date: string; startTime: string; endTime: string };

/**
 * Sinh danh sách buổi học theo lịch cố định trong khoảng [from, to] (tính cả hai đầu),
 * giới hạn trong thời gian hoạt động của lớp [classStart, classEnd].
 * Hàm thuần, không đụng database: việc ghi (idempotent) làm ở tầng dịch vụ.
 */
export function planSessions(
  rules: ScheduleRule[],
  range: { from: string; to: string },
  classStart: string,
  classEnd?: string | null,
): PlannedSession[] {
  const from = range.from > classStart ? range.from : classStart;
  const to = classEnd && classEnd < range.to ? classEnd : range.to;
  const out: PlannedSession[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const wd = weekday(day);
    for (const r of rules) {
      if (r.weekday !== wd) continue;
      if (day < r.validFrom) continue;
      if (r.validTo && day > r.validTo) continue;
      out.push({ date: day, startTime: r.startTime, endTime: r.endTime });
    }
  }
  return out.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}
