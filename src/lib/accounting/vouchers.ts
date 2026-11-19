import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

/** Số chứng từ tiếp theo dạng PT2611-0007 cho loại và tháng của ngày `day`. */
export async function nextCashCode(tx: Tx, type: string, day: string) {
  const prefix = `${type}${day.slice(2, 4)}${day.slice(5, 7)}-`;
  const last = await tx.cashTxn.findFirst({ where: { code: { startsWith: prefix } }, orderBy: { code: "desc" }, select: { code: true } });
  const n = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export async function nextEntryNo(tx: Tx, voucherType: string, day: string) {
  const prefix = `${voucherType}${day.slice(2, 4)}${day.slice(5, 7)}-`;
  const last = await tx.journalEntry.findFirst({ where: { voucherType, voucherNo: { startsWith: prefix } }, orderBy: { voucherNo: "desc" }, select: { voucherNo: true } });
  const n = last ? Number(last.voucherNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Loại chứng từ tiền: PT/PC cho quỹ tiền mặt, BC/BN cho ngân hàng. */
export const cashVoucherType = (type: "IN" | "OUT", kind: "CASH" | "BANK") =>
  type === "IN" ? (kind === "BANK" ? "BC" : "PT") : kind === "BANK" ? "BN" : "PC";
