import type { ReadCell } from "@/lib/xlsx-read";

/** Bỏ dấu, chữ thường, gộp khoảng trắng: so khớp tên nhân sự và tiêu đề cột không phụ thuộc cách gõ. */
export const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Các thành phần của một dòng lương (đồng). */
export type PayParts = { baseSalary: number; overtimePay: number; holidayPay: number; allowance: number; bonus: number; insurance: number; pit: number; advance: number; deduction?: number };

/** Tổng lương = lương chính + tăng ca + ngày lễ + phụ cấp + thưởng (chưa trừ bảo hiểm, thuế, ứng). */
export const grossOf = (l: Pick<PayParts, "baseSalary" | "overtimePay" | "holidayPay" | "allowance" | "bonus">) => l.baseSalary + l.overtimePay + l.holidayPay + l.allowance + l.bonus;
/** Thực lĩnh = tổng lương − BHXH − thuế TNCN − ứng lương − khấu trừ khác. */
export const netOf = (l: PayParts) => grossOf(l) - l.insurance - l.pit - l.advance - (l.deduction ?? 0);

export type ParsedRow = {
  line: number; // số dòng trong file (bắt đầu từ 1)
  stt: number | null; code: string | null; name: string; position: string | null;
  salaryNorm: number; workDays: number; sessions: number | null;
  baseSalary: number; overtimePay: number; holidayPay: number; allowance: number; bonus: number;
  insurance: number; pit: number; advance: number; grossFile: number | null; netFile: number | null;
  errors: string[]; warnings: string[];
};
export type ParsedPayroll = { month: string | null; rows: ParsedRow[]; warnings: string[]; totalRow: Record<string, number> | null };

/** Tiêu đề cột (đã chuẩn hóa) → trường. Có thể bổ sung "Mã NV" để khớp nhân sự chắc chắn hơn tên. */
const HEADERS: Record<string, string[]> = {
  stt: ["stt"], code: ["ma nv", "ma nhan vien", "ma"], name: ["ho ten", "ho va ten", "ten nhan vien", "nhan vien"], position: ["chuc vu", "chuc danh"],
  salaryNorm: ["dinh muc luong", "dinh muc", "luong co ban"], workDays: ["ngay cong thuc te", "ngay cong"], sessions: ["buoi day", "so buoi day", "so buoi"],
  baseSalary: ["luong chinh", "luong theo ngay cong"], overtimePay: ["luong tang ca", "tang ca"], holidayPay: ["luong ngay le", "ngay le"],
  allowance: ["phu cap"], bonus: ["thuong"], insurance: ["bhxh", "bao hiem", "bhxh bhyt bhtn"], pit: ["thue tncn", "thue", "thue thu nhap ca nhan"],
  gross: ["tong luong", "tong thu nhap"], advance: ["ung luong", "tam ung"], net: ["thuc linh", "con lai", "thuc nhan"],
};

const num = (v: ReadCell): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[.\s,đ₫]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Đọc bảng lương từ các dòng của sheet. Quy ước (theo mẫu kế toán):
 * dòng tiêu đề có "Họ tên", dòng "Bảng lương tháng MM/YYYY" phía trên, dòng "TỔNG CỘNG" ở cuối.
 */
export function parsePayroll(sheetRows: ReadCell[][]): ParsedPayroll {
  const warnings: string[] = [];
  let month: string | null = null;
  for (const r of sheetRows.slice(0, 8)) for (const c of r ?? []) {
    const m = typeof c === "string" ? /th[aá]ng\s*(\d{1,2})\s*[/\-.]\s*(\d{4})/i.exec(c) : null;
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) { month = `${m[2]}-${m[1].padStart(2, "0")}`; break; }
  }
  const hi = sheetRows.findIndex((r) => (r ?? []).some((c) => HEADERS.name.includes(norm(c))));
  if (hi < 0) return { month, rows: [], warnings: ["Không thấy dòng tiêu đề có cột “Họ tên”."], totalRow: null };
  const col: Record<string, number> = {};
  (sheetRows[hi] ?? []).forEach((c, i) => {
    const h = norm(c);
    for (const [k, names] of Object.entries(HEADERS)) if (col[k] === undefined && names.includes(h)) col[k] = i;
  });
  const missing = ["name", "baseSalary", "net"].filter((k) => col[k] === undefined);
  if (missing.length) warnings.push(`Thiếu cột bắt buộc: ${missing.map((k) => ({ name: "Họ tên", baseSalary: "Lương chính", net: "Thực lĩnh" })[k as "name"]).join(", ")}.`);
  const at = (r: ReadCell[], k: string) => (col[k] === undefined ? null : r[col[k]] ?? null);
  const rows: ParsedRow[] = [];
  let totalRow: Record<string, number> | null = null;
  const seen = new Set<string>();
  for (let i = hi + 1; i < sheetRows.length; i++) {
    const r = sheetRows[i] ?? [];
    if (r.every((c) => c === null || c === "")) continue;
    const label = norm(at(r, "name") ?? r.find((c) => typeof c === "string"));
    if (label.startsWith("tong cong") || label === "tong") {
      totalRow = {};
      for (const k of ["baseSalary", "overtimePay", "holidayPay", "allowance", "bonus", "insurance", "pit", "gross", "advance", "net"]) { const n = num(at(r, k)); if (n !== null && !Number.isNaN(n)) totalRow[k] = n; }
      break;
    }
    const errors: string[] = [], rowWarn: string[] = [];
    const name = String(at(r, "name") ?? "").trim().replace(/\s+/g, " ");
    if (!name) errors.push("Thiếu họ tên.");
    const money = (k: string, required = false) => {
      const n = num(at(r, k));
      if (n !== null && Number.isNaN(n)) { errors.push(`Cột “${k}” không phải số.`); return 0; }
      if (n === null) { if (required) errors.push("Thiếu số liệu bắt buộc."); return 0; }
      if (n < 0) errors.push(`Số âm ở cột “${k}”.`);
      if (!Number.isInteger(n)) { rowWarn.push(`Làm tròn ${n} ở cột “${k}”.`); return Math.round(n); }
      return n;
    };
    const p: ParsedRow = {
      line: i + 1, stt: num(at(r, "stt")), code: at(r, "code") === null ? null : String(at(r, "code")).trim() || null, name,
      position: at(r, "position") === null ? null : String(at(r, "position")).trim() || null,
      salaryNorm: money("salaryNorm"), workDays: num(at(r, "workDays")) ?? 0, sessions: num(at(r, "sessions")),
      baseSalary: money("baseSalary", true), overtimePay: money("overtimePay"), holidayPay: money("holidayPay"), allowance: money("allowance"), bonus: money("bonus"),
      insurance: money("insurance"), pit: money("pit"), advance: money("advance"), grossFile: num(at(r, "gross")), netFile: num(at(r, "net")), errors, warnings: rowWarn,
    };
    if (p.netFile === null || Number.isNaN(p.netFile)) errors.push("Thiếu Thực lĩnh.");
    if (p.workDays < 0 || p.workDays > 31) errors.push("Ngày công ngoài khoảng 0–31.");
    if (name) { const k = norm(name); if (seen.has(k)) errors.push("Trùng họ tên với dòng khác trong file."); seen.add(k); }
    // Kiểm tra công thức theo mẫu: tổng lương và thực lĩnh trong file phải khớp các thành phần.
    const g = grossOf(p);
    if (p.grossFile !== null && !Number.isNaN(p.grossFile) && Math.abs(p.grossFile - g) > 1) rowWarn.push(`Tổng lương trong file ${p.grossFile.toLocaleString("vi-VN")} ≠ tổng các khoản ${g.toLocaleString("vi-VN")}.`);
    const n = netOf({ ...p, deduction: 0 });
    if (p.netFile !== null && !Number.isNaN(p.netFile) && Math.abs(p.netFile - n) > 1) rowWarn.push(`Thực lĩnh trong file ${p.netFile.toLocaleString("vi-VN")} ≠ tính lại ${n.toLocaleString("vi-VN")}.`);
    rows.push(p);
  }
  if (rows.length === 0) warnings.push("Không có dòng nhân sự nào dưới dòng tiêu đề.");
  if (totalRow) {
    const sum = (f: (r: ParsedRow) => number) => rows.reduce((s, r) => s + f(r), 0);
    const chk: [string, number][] = [["baseSalary", sum((r) => r.baseSalary)], ["bonus", sum((r) => r.bonus)], ["insurance", sum((r) => r.insurance)], ["pit", sum((r) => r.pit)], ["advance", sum((r) => r.advance)], ["net", sum((r) => r.netFile ?? 0)]];
    for (const [k, v] of chk) if (totalRow[k] !== undefined && Math.abs(totalRow[k] - v) > 1) warnings.push(`Dòng TỔNG CỘNG (${k}) ${totalRow[k].toLocaleString("vi-VN")} ≠ cộng các dòng ${v.toLocaleString("vi-VN")}.`);
  }
  return { month, rows, warnings, totalRow };
}

/** Chức vụ có vẻ là giáo viên/trợ giảng → bộ phận Giáo viên (chi phí 632), còn lại Văn phòng (6422). */
export const departmentOf = (position: string | null) => (/(^|\s)(gv|giao vien|giang vien|tro giang)(\s|$)/.test(norm(position)) ? "GIAO_VIEN" : "VAN_PHONG");
