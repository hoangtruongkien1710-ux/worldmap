import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("ma trận quyền", () => {
  it("giáo viên không vào được kế toán và không xem học phí", () => {
    expect(can("TEACHER", "workspace.accounting")).toBe(false);
    expect(can("TEACHER", "tuition.view")).toBe(false);
    expect(can("TEACHER", "attendance.take")).toBe(true);
  });
  it("kế toán vào được cả hai không gian nhưng không quản lý lớp", () => {
    expect(can("ACCOUNTANT", "workspace.accounting")).toBe(true);
    expect(can("ACCOUNTANT", "workspace.classroom")).toBe(true);
    expect(can("ACCOUNTANT", "class.manage")).toBe(false);
  });
  it("quản lý không vào kế toán, không xem lương", () => {
    expect(can("MANAGER", "workspace.accounting")).toBe(false);
    expect(can("MANAGER", "payroll.view")).toBe(false);
  });
  it("chưa đăng nhập thì không có quyền gì", () => {
    expect(can(undefined, "class.view")).toBe(false);
  });
});
