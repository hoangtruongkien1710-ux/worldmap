import type { Prisma, PrismaClient } from "@prisma/client";
import { postEntry } from "@/lib/accounting/posting";
import { nextEntryNo } from "@/lib/accounting/vouchers";
import { createCashTxn, voidCashTxn } from "@/lib/accounting/cash-service";
import { monthOf, todayVN, toDate, toDay } from "@/lib/dates";
import { roundTo } from "@/lib/money";
import { UserError } from "@/lib/actions/util";
import type { InvoiceItem } from "./summary";

type Tx = PrismaClient | Prisma.TransactionClient;

/** Học phí phải thu của một ghi danh: theo khóa = giá khóa; theo buổi = số buổi đã học × đơn giá; trừ ưu đãi. */
export function enrollmentDue(c: { feeMode: string; unitPrice: number }, percentDiscount: number, heldSessions: number) {
  const gross = c.feeMode === "PER_SESSION" ? c.unitPrice * heldSessions : c.unitPrice;
  const discount = roundTo((gross * percentDiscount) / 100);
  return { gross, discount, amount: gross - discount };
}

/** Tìm phiếu học phí đang chứa lớp này; chưa có thì chốt phiếu mới (ghi nhận phải thu Nợ 131 / Có 5113). */
export async function ensureInvoice(tx: Tx, enrollmentId: string, actorId: string) {
  const e = await tx.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { student: true, class: { include: { sessions: { where: { status: "SCHEDULED" }, select: { date: true } } } } },
  });
  const invoices = await tx.invoice.findMany({ where: { studentId: e.studentId } });
  const found = invoices.find((i) => ((i.lockedDetail ?? []) as InvoiceItem[]).some((it) => it.classId === e.classId));
  if (found) return { invoice: found, enrollment: e };

  const today = todayVN();
  const held = e.class.sessions.filter((s) => toDay(s.date) <= today && s.date >= e.joinDate).length;
  const due = enrollmentDue(e.class, e.percentDiscount, held);
  if (due.amount <= 0) throw new UserError("Chưa có học phí phải thu cho học viên này (lớp theo buổi chưa có buổi nào).");
  const item: InvoiceItem = { classId: e.classId, className: e.class.name, gross: due.gross, discount: due.discount, amount: due.amount, note: e.class.feeMode === "PER_SESSION" ? `${held} buổi` : undefined };
  const month = monthOf(today);
  const same = invoices.find((i) => i.month === month);
  const invoice = same
    ? await tx.invoice.update({ where: { id: same.id }, data: { lockedAmount: (same.lockedAmount ?? 0) + due.amount, lockedDetail: [...((same.lockedDetail ?? []) as InvoiceItem[]), item] as never } })
    : await tx.invoice.create({ data: { studentId: e.studentId, month, status: "LOCKED", lockedAmount: due.amount, lockedDetail: [item] as never, lockedAt: new Date(), lockedById: actorId } });
  await postEntry(tx, {
    date: toDate(today), voucherType: "HP", voucherNo: await nextEntryNo(tx, "HP", today),
    description: `Ghi nhận học phí ${e.class.name} – ${e.student.fullName}`, sourceType: "Invoice", sourceId: invoice.id,
    lines: [
      { accountCode: "131", debit: due.amount, studentId: e.studentId, classId: e.classId },
      { accountCode: "5113", credit: due.amount, studentId: e.studentId, classId: e.classId },
    ],
  });
  return { invoice, enrollment: e };
}

/** Thu học phí một lần (có thể thu nhiều lần). Mỗi lần thu lưu một Payment + một phiếu thu / báo có. */
export async function recordPayment(tx: Tx, i: {
  enrollmentId: string; amount: number; method: "CASH" | "TRANSFER"; accountId: string; day: string; note?: string | null; txnRef?: string | null; actorId: string; idempotencyKey: string;
}) {
  const dup = await tx.payment.findUnique({ where: { idempotencyKey: i.idempotencyKey } });
  if (dup) return dup; // bấm 2 lần không bị thu trùng
  if (!(i.amount > 0)) throw new UserError("Số tiền thu phải lớn hơn 0.");
  const { invoice, enrollment } = await ensureInvoice(tx, i.enrollmentId, i.actorId);
  const payment = await tx.payment.create({
    data: {
      invoiceId: invoice.id, classId: enrollment.classId, amount: i.amount, method: i.method, paidAt: toDate(i.day),
      collectedById: i.actorId, idempotencyKey: i.idempotencyKey, note: i.note ?? null, txnRef: i.txnRef ?? null,
    },
  });
  const cat = await tx.txnCategory.findUnique({ where: { code: "THU_HP" } });
  await createCashTxn(tx, {
    type: "IN", accountId: i.accountId, day: i.day, amount: i.amount, categoryId: cat?.id,
    description: `Thu học phí ${enrollment.class.name} – ${enrollment.student.fullName}${i.note ? ` (${i.note})` : ""}`,
    counterparty: enrollment.student.fullName, studentId: enrollment.studentId, paymentId: payment.id,
    other: { accountCode: "131", studentId: enrollment.studentId, classId: enrollment.classId },
  });
  return payment;
}

/** Hủy một lần thu: đánh dấu hủy, phiếu thu tương ứng bị hủy và ghi bút toán đảo. */
export async function voidPayment(tx: Tx, paymentId: string) {
  const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.voidedAt) return p;
  const txn = await tx.cashTxn.findUnique({ where: { paymentId: p.id } });
  if (txn) await voidCashTxn(tx, txn.id, todayVN());
  return tx.payment.update({ where: { id: p.id }, data: { voidedAt: new Date() } });
}
