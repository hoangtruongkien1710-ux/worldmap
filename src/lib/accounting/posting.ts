import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

export type EntryLine = {
  accountCode: string;
  debit?: number;
  credit?: number;
  studentId?: string | null;
  supplierId?: string | null;
  employeeId?: string | null;
  cashAccountId?: string | null;
  classId?: string | null;
};

export type EntryInput = {
  date: Date;
  voucherType: string;
  voucherNo: string;
  description: string;
  sourceType?: string;
  sourceId?: string;
  lines: EntryLine[];
};

/** Kiểm tra bút toán kép: tổng Nợ = tổng Có, không có dòng âm, có ít nhất 2 dòng. */
export function validateEntry(lines: EntryLine[]): void {
  if (lines.length < 2) throw new Error("Bút toán phải có ít nhất 2 dòng.");
  let dr = 0;
  let cr = 0;
  for (const l of lines) {
    const d = l.debit ?? 0;
    const c = l.credit ?? 0;
    if (d < 0 || c < 0 || !Number.isInteger(d) || !Number.isInteger(c)) throw new Error("Số tiền bút toán không hợp lệ.");
    if (d > 0 && c > 0) throw new Error("Một dòng không được vừa Nợ vừa Có.");
    dr += d;
    cr += c;
  }
  if (dr !== cr) throw new Error(`Bút toán lệch: Nợ ${dr} ≠ Có ${cr}.`);
  if (dr === 0) throw new Error("Bút toán không có số tiền.");
}

/** Ghi một bút toán (dùng trong cùng transaction với chứng từ gốc). */
export async function postEntry(db: Tx, input: EntryInput) {
  const lines = input.lines.filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0);
  validateEntry(lines);
  return db.journalEntry.create({
    data: {
      date: input.date,
      voucherType: input.voucherType,
      voucherNo: input.voucherNo,
      description: input.description,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      lines: { create: lines.map((l) => ({ ...l, debit: l.debit ?? 0, credit: l.credit ?? 0 })) },
    },
  });
}

/** Hệ thống tài khoản rút gọn theo TT133 dùng cho trung tâm. */
export const CHART_OF_ACCOUNTS: { code: string; name: string; parentCode?: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" }[] = [
  { code: "111", name: "Tiền mặt", type: "ASSET" },
  { code: "1111", name: "Tiền mặt VNĐ", parentCode: "111", type: "ASSET" },
  { code: "112", name: "Tiền gửi ngân hàng", type: "ASSET" },
  { code: "1121", name: "Tiền gửi ngân hàng VNĐ", parentCode: "112", type: "ASSET" },
  { code: "131", name: "Phải thu của khách hàng (học phí)", type: "ASSET" },
  { code: "154", name: "Chi phí dịch vụ dở dang", type: "EXPENSE" },
  { code: "331", name: "Phải trả cho người bán", type: "LIABILITY" },
  { code: "3335", name: "Thuế thu nhập cá nhân", type: "LIABILITY" },
  { code: "334", name: "Phải trả người lao động", type: "LIABILITY" },
  { code: "3383", name: "Bảo hiểm xã hội", type: "LIABILITY" },
  { code: "3387", name: "Doanh thu chưa thực hiện", type: "LIABILITY" },
  { code: "411", name: "Vốn đầu tư của chủ sở hữu", type: "EQUITY" },
  { code: "421", name: "Lợi nhuận sau thuế chưa phân phối", type: "EQUITY" },
  { code: "511", name: "Doanh thu bán hàng và cung cấp dịch vụ", type: "REVENUE" },
  { code: "5113", name: "Doanh thu học phí", parentCode: "511", type: "REVENUE" },
  { code: "5118", name: "Doanh thu khác (giáo trình, phí thi)", parentCode: "511", type: "REVENUE" },
  { code: "632", name: "Giá vốn dịch vụ (lương giáo viên, giáo trình)", type: "EXPENSE" },
  { code: "642", name: "Chi phí quản lý kinh doanh", type: "EXPENSE" },
  { code: "6421", name: "Chi phí bán hàng (marketing)", parentCode: "642", type: "EXPENSE" },
  { code: "6422", name: "Chi phí quản lý (thuê nhà, điện nước, lương VP…)", parentCode: "642", type: "EXPENSE" },
  { code: "711", name: "Thu nhập khác", type: "REVENUE" },
  { code: "811", name: "Chi phí khác", type: "EXPENSE" },
  { code: "911", name: "Xác định kết quả kinh doanh", type: "EQUITY" },
];
