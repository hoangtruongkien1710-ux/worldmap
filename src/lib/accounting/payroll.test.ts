import { describe, expect, it } from "vitest";
import { xlsx } from "@/lib/xlsx";
import { readXlsx } from "@/lib/xlsx-read";
import { departmentOf, grossOf, netOf, parsePayroll } from "./payroll";

const HEAD = ["STT", "Họ tên", "Chức vụ", "Định mức lương", "Ngày công thực tế", "Buổi dạy", "Lương chính", "Lương tăng ca", "Lương ngày lễ", "Phụ cấp", "Thưởng", "BHXH", "Thuế TNCN", "Tổng lương", "Ứng lương", "Thực lĩnh"];
const sheet = (rows: (string | number | null)[][]) => readXlsx(xlsx([{ name: "Lương", rows, headerRows: [3], freeze: 4 }]))[0].rows;
const body = (extra: (string | number | null)[][] = []) => [
  [], [null, "Bảng lương tháng 11/2026"], [], HEAD,
  [1, "Nguyen Van A", "Giáo viên IELTS", 8000000, 26, 40, 8000000, 0, 0, 500000, 100000, 840000, 0, 8600000, 1000000, 6760000],
  [2, "Tran Thi B", "Kế toán", 6000000, 26, null, 6000000, 0, 0, 0, 0, 630000, 0, 6000000, 0, 5370000],
  ...extra,
];

describe("công thức lương", () => {
  it("tổng lương và thực lĩnh theo mẫu", () => {
    const p = { baseSalary: 8000000, overtimePay: 100, holidayPay: 200, allowance: 500000, bonus: 100000, insurance: 840000, pit: 0, advance: 1000000 };
    expect(grossOf(p)).toBe(8600300);
    expect(netOf(p)).toBe(6760300);
  });
  it("phân bộ phận theo chức vụ", () => {
    expect(departmentOf("Giáo viên IELTS")).toBe("GIAO_VIEN");
    expect(departmentOf("GV tiếng Anh theo buổi")).toBe("GIAO_VIEN");
    expect(departmentOf("Kế toán")).toBe("VAN_PHONG");
  });
});

describe("đọc bảng lương Excel", () => {
  it("đọc tháng, dòng nhân sự và khớp dòng TỔNG CỘNG", () => {
    const p = parsePayroll(sheet(body([["", "TỔNG CỘNG", "", "", "", "", 14000000, 0, 0, 500000, 100000, 1470000, 0, 14600000, 1000000, 12130000]])));
    expect(p.month).toBe("2026-11");
    expect(p.rows).toHaveLength(2);
    expect(p.rows.every((r) => r.errors.length === 0)).toBe(true);
    expect(p.warnings).toEqual([]);
    expect(p.rows[0].advance).toBe(1000000);
    expect(p.rows[0].netFile).toBe(6760000);
  });
  it("báo lỗi dòng trùng tên, số âm, thiếu tên", () => {
    const rows = body([[3, "tran thi b", "Kế toán", 0, 26, null, -5, 0, 0, 0, 0, 0, 0, 0, 0, 0], [4, "", "Kế toán", 0, 26, null, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1]]);
    const p = parsePayroll(sheet(rows));
    expect(p.rows[2].errors.join(" ")).toMatch(/Trùng/);
    expect(p.rows[2].errors.join(" ")).toMatch(/âm/);
    expect(p.rows[3].errors.join(" ")).toMatch(/Thiếu họ tên/);
  });
  it("cảnh báo khi thực lĩnh trong file lệch công thức", () => {
    const rows = body();
    rows[4][15] = 9999999;
    const p = parsePayroll(sheet(rows));
    expect(p.rows[0].warnings.join(" ")).toMatch(/Thực lĩnh/);
  });
  it("thiếu dòng tiêu đề thì báo", () => {
    expect(parsePayroll([["a", "b"]]).warnings[0]).toMatch(/Họ tên/);
  });
});
