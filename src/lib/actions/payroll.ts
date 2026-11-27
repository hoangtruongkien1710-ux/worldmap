"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { readXlsx } from "@/lib/xlsx-read";
import { departmentOf, grossOf, netOf, norm, parsePayroll, type ParsedRow } from "@/lib/accounting/payroll";
import { createCashTxn, voidCashTxn } from "@/lib/accounting/cash-service";
import { postEntry } from "@/lib/accounting/posting";
import { monthRange, todayVN, toDate } from "@/lib/dates";
import type { ActionResult } from "@/components/ui/modal";
import { audit, day, int, req, run, str, UserError } from "./util";

const PATHS = ["/ke-toan"];
const MAX_MB = 5;

export type PreviewRow = Pick<ParsedRow, "line" | "name" | "position" | "salaryNorm" | "workDays" | "sessions" | "baseSalary" | "overtimePay" | "holidayPay" | "allowance" | "bonus" | "insurance" | "pit" | "advance" | "netFile" | "errors" | "warnings"> & {
  gross: number; match: { code: string; fullName: string } | null; newCode: string | null;
};
export type PayrollPreview =
  | { ok: false; error: string }
  | { ok: true; month: string; fileName: string; existing: "IMPORTED" | "LOCKED" | "PAID" | null; rows: PreviewRow[]; warnings: string[]; blocking: number };

/** Đọc file tải lên + so khớp nhân sự; dùng chung cho xem trước và nhập thật. */
async function analyse(f: FormData) {
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Chọn file Excel (.xlsx) bảng lương.", "file");
  if (!/\.xlsx$/i.test(file.name)) throw new UserError("Chỉ nhận file .xlsx (Excel). File .xls cũ hãy mở rồi lưu lại dạng .xlsx.", "file");
  if (file.size > MAX_MB * 1024 * 1024) throw new UserError(`File tối đa ${MAX_MB} MB.`, "file");
  let sheet;
  try { sheet = readXlsx(new Uint8Array(await file.arrayBuffer()))[0]; } catch (e) { throw new UserError(e instanceof Error ? e.message : "Không đọc được file Excel.", "file"); }
  if (!sheet) throw new UserError("File không có sheet nào.", "file");
  const parsed = parsePayroll(sheet.rows);
  const override = str(f, "month");
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(override) ? override : parsed.month;
  if (!month) throw new UserError("Không thấy dòng “Bảng lương tháng MM/YYYY” ở đầu file. Hãy chọn tháng ở ô “Tháng” rồi xem trước lại.", "month");
  const [employees, users, existing] = await Promise.all([
    db.employee.findMany(),
    db.user.findMany({ where: { role: "TEACHER" }, select: { id: true, fullName: true } }),
    db.payrollPeriod.findUnique({ where: { month }, select: { status: true } }),
  ]);
  const byCode = new Map(employees.map((e) => [e.code.toLowerCase(), e]));
  const byName = new Map(employees.map((e) => [norm(e.fullName), e]));
  // Mã mới: GV-xx cho giáo viên, NV-xx cho văn phòng, nối tiếp mã đang có.
  const next: Record<string, number> = {};
  for (const pre of ["GV", "NV"]) next[pre] = Math.max(0, ...employees.map((e) => Number(new RegExp(`^${pre}-(\\d+)$`).exec(e.code)?.[1] ?? 0)));
  const rows = parsed.rows.map((r) => {
    const found = (r.code && byCode.get(r.code.toLowerCase())) || byName.get(norm(r.name)) || null;
    let newCode: string | null = null;
    if (!found && r.name) { const pre = departmentOf(r.position) === "GIAO_VIEN" ? "GV" : "NV"; newCode = `${pre}-${String(++next[pre]).padStart(2, "0")}`; }
    return { r, found, newCode };
  });
  return { parsed, month, existing: (existing?.status ?? null) as "IMPORTED" | "LOCKED" | "PAID" | null, rows, users, file };
}

/** Bước 1: xem trước, chưa ghi gì vào dữ liệu. */
export async function previewPayroll(f: FormData): Promise<PayrollPreview> {
  try {
    await requirePermission("accounting.post");
    const a = await analyse(f);
    const rows: PreviewRow[] = a.rows.map(({ r, found, newCode }) => ({
      line: r.line, name: r.name, position: r.position, salaryNorm: r.salaryNorm, workDays: r.workDays, sessions: r.sessions, baseSalary: r.baseSalary, overtimePay: r.overtimePay,
      holidayPay: r.holidayPay, allowance: r.allowance, bonus: r.bonus, insurance: r.insurance, pit: r.pit, advance: r.advance, netFile: r.netFile, errors: r.errors, warnings: r.warnings,
      gross: grossOf(r), match: found ? { code: found.code, fullName: found.fullName } : null, newCode,
    }));
    const blocking = rows.reduce((s, r) => s + r.errors.length, 0) + (a.parsed.rows.length === 0 ? 1 : 0);
    return { ok: true, month: a.month, fileName: a.file.name, existing: a.existing, rows, warnings: a.parsed.warnings, blocking };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof Error && e.message.includes("không có quyền")) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Không đọc được file, hãy thử lại." };
  }
}

/** Bước 2: nhập thật. Tháng đã có bảng lương "đã nhập, chưa chốt" thì thay thế; đã chốt/đã trả thì chặn. */
export async function importPayroll(_: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const a = await analyse(f);
    if (a.parsed.rows.length === 0) throw new UserError("File không có dòng nhân sự nào.", "file");
    const bad = a.rows.find((x) => x.r.errors.length);
    if (bad) throw new UserError(`Dòng ${bad.r.line} (${bad.r.name || "không tên"}): ${bad.r.errors[0]} Sửa file rồi chọn lại.`, "file");
    if (a.existing === "LOCKED") throw new UserError("Bảng lương tháng này đã chốt. Hãy “Hủy chốt” rồi nhập lại.");
    if (a.existing === "PAID") throw new UserError("Bảng lương tháng này đã trả lương, không nhập lại được.");
    const userByName = new Map(a.users.map((u) => [norm(u.fullName), u.id]));
    await db.$transaction(async (tx) => {
      const period = a.existing
        ? await tx.payrollPeriod.update({ where: { month: a.month }, data: { sourceFile: a.file.name, importedAt: new Date() } })
        : await tx.payrollPeriod.create({ data: { month: a.month, status: "IMPORTED", sourceFile: a.file.name, importedAt: new Date() } });
      if (a.existing) await tx.payrollLine.deleteMany({ where: { periodId: period.id } });
      for (const { r, found, newCode } of a.rows) {
        const dept = departmentOf(r.position);
        const emp = found
          ? await tx.employee.update({ where: { id: found.id }, data: { active: true, ...(r.position ? { position: r.position, department: dept } : {}) } })
          : await tx.employee.create({ data: { code: newCode!, fullName: r.name, department: dept, position: r.position, userId: dept === "GIAO_VIEN" ? userByName.get(norm(r.name)) ?? null : null } });
        await tx.payrollLine.create({
          data: {
            periodId: period.id, employeeId: emp.id, workDays: r.workDays, teachingSessions: r.sessions, salaryNorm: r.salaryNorm, baseSalary: r.baseSalary,
            overtimePay: r.overtimePay, holidayPay: r.holidayPay, allowance: r.allowance, bonus: r.bonus, insurance: r.insurance, pit: r.pit, advance: r.advance, netPay: r.netFile ?? netOf(r),
          },
        });
      }
    });
    await audit(user.id, a.existing ? "reimport" : "import", "PayrollPeriod", a.month, { file: a.file.name, rows: a.rows.length });
    return `Đã nhập bảng lương tháng ${a.month.slice(5)}/${a.month.slice(0, 4)} (${a.rows.length} nhân sự).`;
  }, PATHS);
}

const periodOf = async (id: string) => db.payrollPeriod.findUniqueOrThrow({ where: { id }, include: { lines: { include: { employee: true } } } });
const voucherNo = (month: string) => `BL${month.slice(2, 4)}${month.slice(5)}`;

/** Chốt bảng lương: ghi nhận chi phí lương và các khoản phải trả (Nợ 632/6422; Có 3383, 3335, 334). */
export async function lockPayroll(periodId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const p = await periodOf(periodId);
    if (p.status !== "IMPORTED") throw new UserError("Bảng lương này đã chốt.");
    if (p.lines.length === 0) throw new UserError("Bảng lương không có nhân sự nào.");
    const sum = (f: (l: (typeof p.lines)[number]) => number, dept?: string) => p.lines.filter((l) => !dept || l.employee.department === dept).reduce((s, l) => s + f(l), 0);
    const teacher = sum(grossOf, "GIAO_VIEN"), office = sum(grossOf, "VAN_PHONG");
    const ins = sum((l) => l.insurance), pit = sum((l) => l.pit);
    // Có 334 gồm cả phần ứng lương: các khoản đã ứng chi trước bằng phiếu chi "Trả lương" (Nợ 334) sẽ bù trừ.
    await db.$transaction(async (tx) => {
      await postEntry(tx, {
        date: toDate(monthRange(p.month).to), voucherType: "LUONG", voucherNo: voucherNo(p.month),
        description: `Hạch toán bảng lương tháng ${p.month.slice(5)}/${p.month.slice(0, 4)}`, sourceType: "PayrollPeriod", sourceId: p.id,
        lines: [
          { accountCode: "632", debit: teacher }, { accountCode: "6422", debit: office },
          { accountCode: "3383", credit: ins }, { accountCode: "3335", credit: pit }, { accountCode: "334", credit: teacher + office - ins - pit },
        ],
      });
      await tx.payrollPeriod.update({ where: { id: p.id }, data: { status: "LOCKED" } });
    });
    await audit(user.id, "lock", "PayrollPeriod", p.id, { month: p.month });
    return `Đã chốt bảng lương tháng ${p.month.slice(5)}/${p.month.slice(0, 4)}.`;
  }, PATHS);
}

/** Hủy chốt (chưa trả lương): xóa bút toán hạch toán, bảng lương về trạng thái đã nhập để sửa. */
export async function unlockPayroll(periodId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const p = await db.payrollPeriod.findUniqueOrThrow({ where: { id: periodId } });
    if (p.status === "PAID") throw new UserError("Đã trả lương. Hãy “Hủy trả lương” trước.");
    if (p.status !== "LOCKED") throw new UserError("Bảng lương chưa chốt.");
    await db.$transaction(async (tx) => {
      await tx.journalEntry.deleteMany({ where: { sourceType: "PayrollPeriod", sourceId: p.id, voucherType: "LUONG" } });
      await tx.payrollPeriod.update({ where: { id: p.id }, data: { status: "IMPORTED" } });
    });
    await audit(user.id, "unlock", "PayrollPeriod", p.id, { month: p.month });
    return "Đã hủy chốt, bảng lương về trạng thái chờ chốt.";
  }, PATHS);
}

/** Trả lương: lập phiếu chi / báo nợ bằng đúng tổng thực lĩnh (Nợ 334). */
export async function payPayroll(periodId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const p = await periodOf(periodId);
    if (p.status !== "LOCKED") throw new UserError(p.status === "PAID" ? "Đã trả lương tháng này." : "Hãy chốt bảng lương trước khi trả.");
    const amount = p.lines.reduce((s, l) => s + l.netPay, 0);
    if (amount <= 0) throw new UserError("Tổng thực lĩnh bằng 0, không có gì để trả.");
    const cat = await db.txnCategory.findUniqueOrThrow({ where: { code: "CHI_LUONG" } });
    await db.$transaction(async (tx) => {
      await createCashTxn(tx, {
        type: "OUT", accountId: req(f, "accountId", "nguồn tiền"), day: day(f, "date", "ngày trả"), amount, categoryId: cat.id, payrollPeriodId: p.id,
        description: `Trả lương tháng ${p.month.slice(5)}/${p.month.slice(0, 4)} cho ${p.lines.length} nhân sự`, other: { accountCode: "334" },
      });
      await tx.payrollPeriod.update({ where: { id: p.id }, data: { status: "PAID" } });
    });
    await audit(user.id, "pay", "PayrollPeriod", p.id, { month: p.month, amount });
    return `Đã lập chứng từ trả lương ${amount.toLocaleString("vi-VN")}đ.`;
  }, PATHS);
}

/** Hủy trả lương: hủy chứng từ chi (ghi bút toán đảo), bảng lương về trạng thái đã chốt. */
export async function cancelPayrollPayment(periodId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const p = await db.payrollPeriod.findUniqueOrThrow({ where: { id: periodId } });
    if (p.status !== "PAID") throw new UserError("Bảng lương này chưa trả.");
    const txns = await db.cashTxn.findMany({ where: { payrollPeriodId: p.id, voidedAt: null, category: { code: "CHI_LUONG" } } });
    await db.$transaction(async (tx) => {
      for (const t of txns) await voidCashTxn(tx, t.id, todayVN());
      await tx.payrollPeriod.update({ where: { id: p.id }, data: { status: "LOCKED" } });
    });
    await audit(user.id, "unpay", "PayrollPeriod", p.id, { month: p.month, vouchers: txns.map((t) => t.code) });
    return "Đã hủy chứng từ trả lương.";
  }, PATHS);
}

/** Xóa cả bảng lương (chỉ khi chưa chốt). */
export async function deletePayroll(periodId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const p = await db.payrollPeriod.findUniqueOrThrow({ where: { id: periodId } });
    if (p.status !== "IMPORTED") throw new UserError("Chỉ xóa được bảng lương chưa chốt. Hãy hủy chốt trước.");
    await db.payrollPeriod.delete({ where: { id: p.id } });
    await audit(user.id, "delete", "PayrollPeriod", p.id, { month: p.month });
    return "Đã xóa bảng lương.";
  }, PATHS);
}

const money = (f: FormData, k: string) => {
  const n = int(f, k);
  return n ?? 0;
};

/** Sửa một dòng lương (khi chưa chốt). Thực lĩnh tự tính lại từ các khoản. */
export async function updatePayrollLine(lineId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const l = await db.payrollLine.findUniqueOrThrow({ where: { id: lineId }, include: { period: true, employee: true } });
    if (l.period.status !== "IMPORTED") throw new UserError("Bảng lương đã chốt, hãy hủy chốt trước khi sửa.");
    const parts = {
      baseSalary: money(f, "baseSalary"), overtimePay: money(f, "overtimePay"), holidayPay: money(f, "holidayPay"), allowance: money(f, "allowance"), bonus: money(f, "bonus"),
      insurance: money(f, "insurance"), pit: money(f, "pit"), advance: money(f, "advance"), deduction: l.deduction,
    };
    const workDays = Number(str(f, "workDays").replace(",", ".") || 0);
    if (!(workDays >= 0 && workDays <= 31)) throw new UserError("Ngày công từ 0 đến 31.", "workDays");
    const sessions = int(f, "teachingSessions");
    const netPay = netOf(parts);
    if (netPay < 0) throw new UserError("Thực lĩnh đang âm: các khoản trừ lớn hơn tổng lương.", "advance");
    await db.payrollLine.update({ where: { id: l.id }, data: { ...parts, salaryNorm: money(f, "salaryNorm"), workDays, teachingSessions: sessions, netPay } });
    await audit(user.id, "update", "PayrollLine", l.id, { employee: l.employee.code, month: l.period.month, netPay });
    return `Đã sửa dòng lương của ${l.employee.fullName}.`;
  }, PATHS);
}

/** Bỏ một nhân sự khỏi bảng lương (khi chưa chốt). */
export async function deletePayrollLine(lineId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const l = await db.payrollLine.findUniqueOrThrow({ where: { id: lineId }, include: { period: true, employee: true } });
    if (l.period.status !== "IMPORTED") throw new UserError("Bảng lương đã chốt, hãy hủy chốt trước khi xóa dòng.");
    await db.payrollLine.delete({ where: { id: l.id } });
    await audit(user.id, "delete", "PayrollLine", l.id, { employee: l.employee.code, month: l.period.month });
    return `Đã bỏ ${l.employee.fullName} khỏi bảng lương.`;
  }, PATHS);
}
