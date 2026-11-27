import { auth } from "@/auth";
import { can } from "@/lib/auth/permissions";
import { fmtDate, todayVN, toDay } from "@/lib/dates";
import { VOUCHER_LABEL, type BookRow } from "@/components/accounting/ui";
import { orderBook } from "./book-sort";
import { grossOf } from "./payroll";
import type { loadExpenses, loadFees, loadPayroll, loadTrial } from "./loaders";
import type { Period } from "./period";
import type { Sheet } from "@/lib/xlsx";
import type { SortState } from "@/lib/sort";

/** Chặn truy cập xuất file khi không có quyền (giống màn hình tương ứng). */
export async function canExport(perm: "accounting.view" | "payroll.view") {
  const session = await auth();
  return can(session?.user?.role, perm);
}

export const queryOf = (req: Request) => Object.fromEntries(new URL(req.url).searchParams) as Record<string, string | undefined>;

/** Tên file: tên trang + khoảng thời gian đang xem. */
export const fileName = (slug: string, p?: Period) => `${slug}-${p && p.key !== "tatca" ? `${p.from}_${p.to}` : todayVN()}.xlsx`;

const day = (d: Date | string | null | undefined) => (d ? fmtDate(d) : "");
const periodRows = (p: Period): (string | number)[][] => [["Kỳ", p.label], ...(p.key === "tatca" ? [] : [["Từ ngày", fmtDate(p.from)], ["Đến ngày", fmtDate(p.to)]]), ["Xuất ngày", fmtDate(todayVN())]];

export function bookSheets(title: string, accountName: string, p: Period, book: { opening: number; rows: BookRow[]; totalIn: number; totalOut: number; closing: number }, sort: SortState): Sheet[] {
  return [
    {
      name: title, widths: [12, 16, 14, 44, 24, 24, 16, 16, 16],
      rows: [
        ["Ngày", "Số chứng từ", "Loại", "Diễn giải", "Khoản mục", "Đối tượng", "Thu", "Chi", "Tồn"],
        ...orderBook(book.rows, sort).map((r) => [fmtDate(r.date), r.code, VOUCHER_LABEL[r.code.match(/^[A-Z]+/)?.[0] ?? ""]?.label ?? "", r.description, r.label, r.counterparty ?? "", r.in || null, r.out || null, r.balance]),
        ["", "", "", "Cộng phát sinh trong kỳ", "", "", book.totalIn, book.totalOut, book.closing],
      ],
    },
    { name: "Tổng hợp", widths: [22, 30], rows: [["Chỉ tiêu", "Giá trị"], ["Tài khoản", accountName], ...periodRows(p), ["Tồn đầu kỳ", book.opening], ["Tổng thu", book.totalIn], ["Tổng chi", book.totalOut], ["Tồn cuối kỳ", book.closing]] },
  ];
}

export function feeSheets(d: Awaited<ReturnType<typeof loadFees>>): Sheet[] {
  const state = (r: (typeof d.shown)[number]) => (r.remain <= 0 ? "Đã đóng đủ" : r.paid > 0 ? "Còn nợ" : "Chưa đóng");
  return [
    {
      name: "Học phí", widths: [10, 26, 14, 22, 14, 10, 34, 14, 14, 14, 14, 14],
      rows: [
        ["Mã HV", "Học viên", "SĐT học viên", "Phụ huynh", "SĐT phụ huynh", "Tháng", "Lớp / khóa", "Phải thu", "Đã thu", "Còn lại", "Thu gần nhất", "Tình trạng"],
        ...d.shown.map((r) => [r.student.code, r.student.fullName, r.student.phone, r.student.parentName, r.student.parentPhone, `${r.month.slice(5)}/${r.month.slice(0, 4)}`, r.classes, r.total, r.paid, Math.max(0, r.remain), day(r.lastPaid), state(r)]),
        ["", "", "", "", "", "", "Cộng", d.shown.reduce((s, r) => s + r.total, 0), d.shown.reduce((s, r) => s + r.paid, 0), d.shown.reduce((s, r) => s + Math.max(0, r.remain), 0), "", ""],
      ],
    },
    {
      name: "Các lần thu", widths: [10, 26, 10, 14, 16, 14, 30],
      rows: [["Mã HV", "Học viên", "Tháng", "Ngày thu", "Hình thức", "Số tiền", "Ghi chú"],
        ...d.shown.flatMap((r) => [...r.payments].reverse().map((p) => [r.student.code, r.student.fullName, `${r.month.slice(5)}/${r.month.slice(0, 4)}`, fmtDate(p.paidAt), p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản", p.amount, p.note]))],
    },
  ];
}

export function expenseSheets(d: Awaited<ReturnType<typeof loadExpenses>>): Sheet[] {
  return [
    {
      name: "Hóa đơn mua hàng", widths: [14, 12, 28, 40, 14, 14, 14, 12, 12],
      rows: [["Số hóa đơn", "Ngày HĐ", "Nhà cung cấp", "Diễn giải", "Số tiền", "Đã trả", "Còn nợ", "Hạn trả", "Tình trạng"],
        ...d.billRows.map((p) => [p.code, fmtDate(p.billDate), p.supplier?.name ?? "", p.description, p.amount, p.paidAmount, Math.max(0, p.remain), fmtDate(p.dueDate), p.remain > 0 ? (toDay(p.dueDate) < todayVN() ? "Quá hạn" : "Còn nợ") : "Đã trả"])],
    },
    {
      name: "Chứng từ chi", widths: [12, 16, 44, 26, 28, 12, 16],
      rows: [["Ngày", "Số chứng từ", "Diễn giải", "Khoản mục", "Nhà cung cấp / người nhận", "Nguồn tiền", "Số tiền"],
        ...d.vRows.map((t) => [fmtDate(t.date), t.code, t.description, t.category?.name ?? "", t.supplier?.name ?? t.counterparty ?? "", t.account.code, t.amount]),
        ["", "", "", "", "", "Cộng", d.total]],
    },
    { name: "Chi theo khoản mục", widths: [30, 14, 16], rows: [["Khoản mục", "Số chứng từ", "Số tiền"], ...d.cats.map((c) => [c.name, c.count, c.amount]), ["Cộng", d.txns.length, d.total]] },
  ];
}

export function trialSheets(d: Awaited<ReturnType<typeof loadTrial>>, types: Record<string, { label: string }>): Sheet[] {
  const D = (v: number) => (v > 0 ? v : null);
  const C = (v: number) => (v < 0 ? -v : null);
  const sum = (f: (r: (typeof d.rows)[number]) => number) => d.rows.reduce((s, r) => s + f(r), 0);
  return [
    {
      name: "Cân đối số phát sinh", widths: [8, 40, 14, 16, 16, 16, 16, 16, 16],
      rows: [["TK", "Tên tài khoản", "Loại", "Đầu kỳ Nợ", "Đầu kỳ Có", "Phát sinh Nợ", "Phát sinh Có", "Cuối kỳ Nợ", "Cuối kỳ Có"],
        ...d.rows.map((r) => [r.code, r.name, types[r.type]?.label ?? "", D(r.open), C(r.open), r.pDebit || null, r.pCredit || null, D(r.close), C(r.close)]),
        ["", "Cộng", "", sum((r) => Math.max(0, r.open)), sum((r) => Math.max(0, -r.open)), sum((r) => r.pDebit), sum((r) => r.pCredit), sum((r) => Math.max(0, r.close)), sum((r) => Math.max(0, -r.close))]],
    },
    { name: "Thông tin", widths: [18, 30], rows: [["Chỉ tiêu", "Giá trị"], ...periodRows(d.period)] },
  ];
}

/** Cột bảng lương theo mẫu kế toán (thêm "Mã NV" ở cột B để khớp nhân sự chắc chắn khi nhập lại). */
export const PAYROLL_HEAD = ["STT", "Mã NV", "Họ tên", "Chức vụ", "Định mức lương", "Ngày công thực tế", "Buổi dạy", "Lương chính", "Lương tăng ca", "Lương ngày lễ", "Phụ cấp", "Thưởng", "BHXH", "Thuế TNCN", "Tổng lương", "Ứng lương", "Thực lĩnh"];
const PAYROLL_WIDTHS = [6, 10, 26, 24, 14, 12, 10, 14, 13, 13, 12, 12, 12, 12, 15, 12, 15];

type PayLine = Awaited<ReturnType<typeof loadPayroll>> extends infer D ? (D extends { lines: (infer L)[] } ? L : never) : never;
const payRow = (l: PayLine, i: number) => [i + 1, l.employee.code, l.employee.fullName, l.employee.position ?? "", l.salaryNorm || null, Number(l.workDays), l.teachingSessions, l.baseSalary, l.overtimePay || null, l.holidayPay || null, l.allowance || null, l.bonus || null, l.insurance || null, l.pit || null, grossOf(l), l.advance || null, l.netPay];

/** Bảng lương đúng bố cục file mẫu: tiêu đề dòng 2, tiêu đề cột dòng 4, dòng TỔNG CỘNG cuối → nhập lại được. */
export function payrollSheets(d: NonNullable<Awaited<ReturnType<typeof loadPayroll>>>): Sheet[] {
  const sum = (f: (l: PayLine) => number) => d.lines.reduce((s, l) => s + f(l), 0);
  const [y, m] = d.period.month.split("-");
  return [{
    name: `Lương ${d.period.month}`, widths: PAYROLL_WIDTHS, headerRows: [3], freeze: 4,
    rows: [[], ["", "", `Bảng lương tháng ${m}/${y}`], [], PAYROLL_HEAD,
      ...d.lines.map(payRow),
      ["", "", "TỔNG CỘNG", "", "", "", sum((l) => l.teachingSessions ?? 0), sum((l) => l.baseSalary), sum((l) => l.overtimePay), sum((l) => l.holidayPay), sum((l) => l.allowance), sum((l) => l.bonus), sum((l) => l.insurance), sum((l) => l.pit), sum(grossOf), sum((l) => l.advance), sum((l) => l.netPay)]],
  }];
}

/** File mẫu trống để kế toán điền rồi nhập vào app. */
export function payrollTemplate(month: string): Sheet[] {
  const [y, m] = month.split("-");
  return [{
    name: `Lương ${month}`, widths: PAYROLL_WIDTHS, headerRows: [3], freeze: 4,
    rows: [[], ["", "", `Bảng lương tháng ${m}/${y}`], [], PAYROLL_HEAD,
      [1, "", "Nguyễn Văn A (ví dụ, xóa dòng này)", "Giáo viên IELTS", 8000000, 26, 40, 8000000, 0, 0, 500000, 0, 840000, 0, 8500000, 0, 7660000],
      ["", "", "TỔNG CỘNG"]],
  }];
}
