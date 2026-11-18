import type { Prisma, PrismaClient } from "@prisma/client";
import { toDate, toDay } from "../dates";
import { planSessions } from "./generate";

type Tx = PrismaClient | Prisma.TransactionClient;

/**
 * Đảm bảo các buổi học theo lịch cố định tồn tại trong khoảng ngày (idempotent).
 * Không động vào buổi đã có (kể cả buổi đã cho nghỉ hoặc đã điểm danh).
 */
export async function syncClassSessions(db: Tx, classId: string, range: { from: string; to: string }) {
  const cls = await db.class.findUniqueOrThrow({ where: { id: classId }, include: { schedules: true } });
  const planned = planSessions(
    cls.schedules.map((s) => ({
      weekday: s.weekday,
      startTime: s.startTime,
      endTime: s.endTime,
      validFrom: toDay(s.validFrom),
      validTo: s.validTo ? toDay(s.validTo) : null,
    })),
    range,
    toDay(cls.startDate),
    cls.endDate ? toDay(cls.endDate) : null,
  );
  if (planned.length === 0) return 0;
  const res = await db.session.createMany({
    data: planned.map((p) => ({
      classId,
      date: toDate(p.date),
      startTime: p.startTime,
      endTime: p.endTime,
      source: "SCHEDULE" as const,
    })),
    skipDuplicates: true,
  });
  return res.count;
}
