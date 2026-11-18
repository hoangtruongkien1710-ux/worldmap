import { describe, expect, it } from "vitest";
import { signedFor } from "./cash";

describe("signedFor", () => {
  const base = { amount: 100, accountId: "A", toAccountId: null };
  it("thu làm tăng, chi làm giảm số dư", () => {
    expect(signedFor({ ...base, type: "IN" }, "A")).toBe(100);
    expect(signedFor({ ...base, type: "OUT" }, "A")).toBe(-100);
    expect(signedFor({ ...base, type: "IN" }, "B")).toBe(0);
  });
  it("chuyển khoản nội bộ: giảm bên chuyển, tăng bên nhận", () => {
    const t = { type: "TRANSFER" as const, amount: 50, accountId: "A", toAccountId: "B" };
    expect(signedFor(t, "A")).toBe(-50);
    expect(signedFor(t, "B")).toBe(50);
    expect(signedFor(t, "C")).toBe(0);
  });
});
