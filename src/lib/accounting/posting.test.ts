import { describe, expect, it } from "vitest";
import { validateEntry } from "./posting";

describe("validateEntry", () => {
  it("chấp nhận bút toán cân", () => {
    expect(() => validateEntry([{ accountCode: "1121", debit: 3_715_000 }, { accountCode: "131", credit: 3_715_000 }])).not.toThrow();
  });
  it("từ chối bút toán lệch", () => {
    expect(() => validateEntry([{ accountCode: "6422", debit: 100 }, { accountCode: "1111", credit: 90 }])).toThrow(/lệch/);
  });
  it("từ chối dòng vừa Nợ vừa Có hoặc số âm", () => {
    expect(() => validateEntry([{ accountCode: "111", debit: 5, credit: 5 }, { accountCode: "131", credit: 0 }])).toThrow();
    expect(() => validateEntry([{ accountCode: "111", debit: -5 }, { accountCode: "131", credit: -5 }])).toThrow();
  });
  it("lương nhiều dòng vẫn cân", () => {
    expect(() => validateEntry([
      { accountCode: "632", debit: 10_000_000 },
      { accountCode: "6422", debit: 30_000_000 },
      { accountCode: "334", credit: 36_850_000 },
      { accountCode: "3383", credit: 3_150_000 },
    ])).not.toThrow();
  });
});
