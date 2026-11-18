import { describe, expect, it } from "vitest";
import { planSessions } from "./generate";

const tueSat = [
  { weekday: 2, startTime: "17:30", endTime: "19:00", validFrom: "2026-08-01" },
  { weekday: 6, startTime: "15:00", endTime: "16:30", validFrom: "2026-08-01" },
];

describe("planSessions", () => {
  it("sinh đủ 8 buổi T3, T7 trong tháng 11/2026", () => {
    const s = planSessions(tueSat, { from: "2026-11-01", to: "2026-11-30" }, "2026-08-01");
    expect(s.map((x) => x.date)).toEqual([
      "2026-11-03", "2026-11-07", "2026-11-10", "2026-11-14",
      "2026-11-17", "2026-11-21", "2026-11-24", "2026-11-28",
    ]);
  });

  it("không sinh buổi trước ngày bắt đầu hoặc sau ngày kết thúc lớp", () => {
    const s = planSessions(tueSat, { from: "2026-11-01", to: "2026-11-30" }, "2026-11-10", "2026-11-21");
    expect(s.map((x) => x.date)).toEqual(["2026-11-10", "2026-11-14", "2026-11-17", "2026-11-21"]);
  });

  it("đổi lịch giữa tháng: lịch cũ hết hiệu lực, lịch mới bắt đầu", () => {
    const rules = [
      { weekday: 2, startTime: "17:30", endTime: "19:00", validFrom: "2026-08-01", validTo: "2026-11-15" },
      { weekday: 4, startTime: "18:00", endTime: "19:30", validFrom: "2026-11-16" },
    ];
    const s = planSessions(rules, { from: "2026-11-01", to: "2026-11-30" }, "2026-08-01");
    expect(s.map((x) => x.date)).toEqual([
      "2026-11-03", "2026-11-10", "2026-11-19", "2026-11-26",
    ]);
  });

  it("một ngày có hai ca vẫn sinh đủ, sắp theo giờ", () => {
    const rules = [
      { weekday: 0, startTime: "14:00", endTime: "15:30", validFrom: "2026-01-01" },
      { weekday: 0, startTime: "08:00", endTime: "10:00", validFrom: "2026-01-01" },
    ];
    const s = planSessions(rules, { from: "2026-11-08", to: "2026-11-08" }, "2026-01-01");
    expect(s.map((x) => x.startTime)).toEqual(["08:00", "14:00"]);
  });
});
