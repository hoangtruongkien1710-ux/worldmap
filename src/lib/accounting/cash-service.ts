import type { Prisma, PrismaClient } from "@prisma/client";
import { postEntry, type EntryLine } from "./posting";
import { cashVoucherType, nextCashCode } from "./vouchers";
import { toDate } from "@/lib/dates";

type Tx = PrismaClient | Prisma.TransactionClient;

export type CashTxnInput = {
  type: "IN" | "OUT";
  accountId: string;
  day: string;
  amount: number;
  description: string;
  categoryId?: number | null;
  counterparty?: string | null;
  supplierId?: string | null;
  studentId?: string | null;
  paymentId?: string | null;
  payableId?: string | null;
  /** Dòng đối ứng (TK Có khi thu, TK Nợ khi chi). */
  other: EntryLine;
};

/** Lập phiếu thu/chi (hoặc báo có/báo nợ) và tự ghi bút toán kép. */
export async function createCashTxn(tx: Tx, i: CashTxnInput) {
  if (!(i.amount > 0)) throw new Error("Số tiền phải lớn hơn 0.");
  const account = await tx.cashAccount.findUniqueOrThrow({ where: { id: i.accountId } });
  const vType = cashVoucherType(i.type, account.kind);
  const code = await nextCashCode(tx, vType, i.day);
  const txn = await tx.cashTxn.create({
    data: {
      code, type: i.type, date: toDate(i.day), accountId: account.id, amount: i.amount, description: i.description,
      categoryId: i.categoryId ?? null, counterparty: i.counterparty ?? null, supplierId: i.supplierId ?? null,
      studentId: i.studentId ?? null, paymentId: i.paymentId ?? null, payableId: i.payableId ?? null,
    },
  });
  const cash: EntryLine = { accountCode: account.ledgerCode, cashAccountId: account.id, [i.type === "IN" ? "debit" : "credit"]: i.amount };
  const other: EntryLine = { ...i.other, [i.type === "IN" ? "credit" : "debit"]: i.amount };
  await postEntry(tx, {
    date: toDate(i.day), voucherType: vType, voucherNo: code, description: i.description, sourceType: "CashTxn", sourceId: txn.id,
    lines: i.type === "IN" ? [cash, other] : [other, cash],
  });
  return txn;
}

/** Hủy chứng từ tiền: đánh dấu đã hủy và ghi bút toán đảo (không xóa để còn dấu vết). */
export async function voidCashTxn(tx: Tx, txnId: string, day: string) {
  const txn = await tx.cashTxn.findUniqueOrThrow({ where: { id: txnId } });
  if (txn.voidedAt) return txn;
  const entries = await tx.journalEntry.findMany({ where: { sourceType: "CashTxn", sourceId: txn.id }, include: { lines: true } });
  for (const e of entries) {
    await postEntry(tx, {
      date: toDate(day), voucherType: "HUY", voucherNo: `HUY-${e.voucherNo}`, description: `Hủy ${e.voucherNo}: ${e.description}`,
      sourceType: "CashTxnVoid", sourceId: txn.id,
      lines: e.lines.map((l) => ({ accountCode: l.accountCode, debit: l.credit, credit: l.debit, studentId: l.studentId, supplierId: l.supplierId, employeeId: l.employeeId, cashAccountId: l.cashAccountId, classId: l.classId })),
    });
  }
  return tx.cashTxn.update({ where: { id: txn.id }, data: { voidedAt: new Date() } });
}
