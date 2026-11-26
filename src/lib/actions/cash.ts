"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { createCashTxn, voidCashTxn } from "@/lib/accounting/cash-service";
import { nextCashCode } from "@/lib/accounting/vouchers";
import { postEntry } from "@/lib/accounting/posting";
import { todayVN, toDate } from "@/lib/dates";
import type { ActionResult } from "@/components/ui/modal";
import { audit, day, int, opt, req, run, UserError } from "./util";

const PATHS = ["/ke-toan"];

/** Lập phiếu thu / phiếu chi (quỹ) hoặc báo có / báo nợ (ngân hàng). */
export async function createVoucher(accountId: string, type: "IN" | "OUT", _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const amount = int(f, "amount", "số tiền");
    if (!amount || amount <= 0) throw new UserError("Số tiền phải lớn hơn 0.", "amount");
    const categoryId = int(f, "categoryId", "khoản mục");
    const cat = await db.txnCategory.findUniqueOrThrow({ where: { id: categoryId! } });
    if (cat.code === "THU_HP") throw new UserError("Thu học phí hãy làm ở tab Học phí của lớp để gắn đúng học viên.");
    const ledger = type === "IN" ? cat.creditAccount : cat.debitAccount;
    if (!ledger) throw new UserError("Khoản mục chưa khai báo tài khoản hạch toán.");
    const supplierId = opt(f, "supplierId");
    const d = day(f, "date", "ngày chứng từ");
    const txn = await db.$transaction((tx) =>
      createCashTxn(tx, {
        type, accountId, day: d, amount, description: req(f, "description", "diễn giải"), categoryId: cat.id,
        counterparty: opt(f, "counterparty"), supplierId,
        other: { accountCode: ledger, supplierId: ledger === "331" ? supplierId : null },
      }),
    );
    await audit(user.id, "create", "CashTxn", txn.id, { code: txn.code });
    return `Đã lập ${txn.code}.`;
  }, PATHS);
}

/** Chuyển tiền giữa quỹ và ngân hàng (nộp tiền mặt, rút tiền, chuyển giữa 2 tài khoản). */
export async function createTransfer(fromId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const toId = req(f, "toAccountId", "tài khoản nhận");
    if (toId === fromId) throw new UserError("Tài khoản nhận phải khác tài khoản chuyển.", "toId");
    const amount = int(f, "amount", "số tiền");
    if (!amount || amount <= 0) throw new UserError("Số tiền phải lớn hơn 0.", "amount");
    const d = day(f, "date", "ngày chứng từ");
    const description = req(f, "description", "diễn giải");
    const code = await db.$transaction(async (tx) => {
      const [from, to] = await Promise.all([tx.cashAccount.findUniqueOrThrow({ where: { id: fromId } }), tx.cashAccount.findUniqueOrThrow({ where: { id: toId } })]);
      const code = await nextCashCode(tx, "CT", d);
      const txn = await tx.cashTxn.create({ data: { code, type: "TRANSFER", date: toDate(d), accountId: from.id, toAccountId: to.id, amount, description } });
      await postEntry(tx, {
        date: toDate(d), voucherType: "CT", voucherNo: code, description, sourceType: "CashTxn", sourceId: txn.id,
        lines: [{ accountCode: to.ledgerCode, debit: amount, cashAccountId: to.id }, { accountCode: from.ledgerCode, credit: amount, cashAccountId: from.id }],
      });
      return code;
    });
    await audit(user.id, "create", "CashTxn", code);
    return `Đã lập ${code}.`;
  }, PATHS);
}

/** Hủy chứng từ: giữ lại, đánh dấu hủy và ghi bút toán đảo. */
export async function voidVoucher(txnId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const t = await db.cashTxn.findUniqueOrThrow({ where: { id: txnId } });
    if (t.paymentId) throw new UserError("Phiếu này sinh từ thu học phí. Hãy hủy lần thu ở tab Học phí của lớp.");
    if (t.payrollPeriodId) throw new UserError("Phiếu trả lương hãy hủy ở màn Tiền lương.");
    await db.$transaction((tx) => voidCashTxn(tx, txnId, todayVN()));
    await audit(user.id, "void", "CashTxn", txnId, { code: t.code });
    return `Đã hủy ${t.code}.`;
  }, PATHS);
}

/* ---------------- Mua hàng trả chậm (công nợ NCC) ---------------- */

export async function createPayable(_: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const supplierId = req(f, "supplierId", "nhà cung cấp");
    const categoryId = int(f, "categoryId", "khoản mục")!;
    const cat = await db.txnCategory.findUniqueOrThrow({ where: { id: categoryId } });
    if (!cat.debitAccount || cat.direction !== "OUT") throw new UserError("Chọn khoản mục chi.");
    const amount = int(f, "amount", "số tiền");
    if (!amount || amount <= 0) throw new UserError("Số tiền phải lớn hơn 0.", "amount");
    const billDate = day(f, "billDate", "ngày hóa đơn");
    const dueDate = day(f, "dueDate", "hạn trả");
    if (dueDate < billDate) throw new UserError("Hạn trả phải sau ngày hóa đơn.", "dueDate");
    const description = req(f, "description", "diễn giải");
    const code = await db.$transaction(async (tx) => {
      const prefix = `MH${billDate.slice(2, 4)}${billDate.slice(5, 7)}-`;
      const last = await tx.payable.findFirst({ where: { code: { startsWith: prefix } }, orderBy: { code: "desc" } });
      const code = `${prefix}${String((last ? Number(last.code.slice(prefix.length)) : 0) + 1).padStart(4, "0")}`;
      const p = await tx.payable.create({ data: { code, supplierId, categoryId, description, amount, billDate: toDate(billDate), dueDate: toDate(dueDate) } });
      await postEntry(tx, {
        date: toDate(billDate), voucherType: "MH", voucherNo: code, description, sourceType: "Payable", sourceId: p.id,
        lines: [{ accountCode: cat.debitAccount!, debit: amount }, { accountCode: "331", credit: amount, supplierId }],
      });
      return code;
    });
    await audit(user.id, "create", "Payable", code);
    return `Đã ghi hóa đơn ${code}.`;
  }, PATHS);
}

/** Trả nợ nhà cung cấp cho một hóa đơn (có thể trả nhiều lần). */
export async function payPayable(payableId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const p = await db.payable.findUniqueOrThrow({ where: { id: payableId }, include: { supplier: true } });
    const paid = await db.cashTxn.aggregate({ where: { payableId, voidedAt: null }, _sum: { amount: true } });
    const remain = p.amount - (paid._sum.amount ?? 0);
    const amount = int(f, "amount", "số tiền");
    if (!amount || amount <= 0) throw new UserError("Số tiền phải lớn hơn 0.", "amount");
    if (amount > remain) throw new UserError("Số tiền vượt quá số còn nợ.", "amount");
    const ncc = await db.txnCategory.findUniqueOrThrow({ where: { code: "CHI_NCC" } });
    const txn = await db.$transaction((tx) =>
      createCashTxn(tx, {
        type: "OUT", accountId: req(f, "accountId", "nguồn tiền"), day: day(f, "date", "ngày trả"), amount,
        description: `Thanh toán ${p.code} – ${p.description}`, categoryId: ncc.id, supplierId: p.supplierId, counterparty: p.supplier?.name,
        payableId, other: { accountCode: "331", supplierId: p.supplierId },
      }),
    );
    await audit(user.id, "pay", "Payable", payableId, { txn: txn.code });
    return `Đã lập ${txn.code}.`;
  }, PATHS);
}

/** Xóa hóa đơn ghi nhầm: chỉ khi chưa trả đồng nào; ghi bút toán đảo. */
export async function deletePayable(payableId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const n = await db.cashTxn.count({ where: { payableId, voidedAt: null } });
    if (n) throw new UserError("Hóa đơn đã có phiếu trả tiền. Hãy hủy các phiếu đó trước.");
    await db.$transaction(async (tx) => {
      const entries = await tx.journalEntry.findMany({ where: { sourceType: "Payable", sourceId: payableId }, include: { lines: true } });
      for (const e of entries) {
        await postEntry(tx, {
          date: toDate(todayVN()), voucherType: "HUY", voucherNo: `HUY-${e.voucherNo}`, description: `Hủy ${e.voucherNo}: ${e.description}`, sourceType: "PayableVoid", sourceId: payableId,
          lines: e.lines.map((l) => ({ accountCode: l.accountCode, debit: l.credit, credit: l.debit, supplierId: l.supplierId })),
        });
      }
      await tx.cashTxn.updateMany({ where: { payableId }, data: { payableId: null } });
      await tx.payable.delete({ where: { id: payableId } });
    });
    await audit(user.id, "delete", "Payable", payableId);
    return "Đã xóa hóa đơn và ghi bút toán đảo.";
  }, PATHS);
}

/* ---------------- Danh mục kế toán ---------------- */

export async function saveCashAccount(id: string | null, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const kind = f.get("kind") === "BANK" ? "BANK" : "CASH";
    const data = { name: req(f, "name", "tên"), bankName: opt(f, "bankName"), accountNo: opt(f, "accountNo") };
    if (id) {
      await db.cashAccount.update({ where: { id }, data: { ...data, active: f.get("active") === "on" } });
    } else {
      await db.cashAccount.create({
        data: { ...data, kind, code: req(f, "code", "mã").toUpperCase(), ledgerCode: kind === "BANK" ? "1121" : "1111", openingBalance: int(f, "openingBalance", undefined, true) ?? 0, openingDate: toDate(day(f, "openingDate", "ngày số dư đầu")) },
      });
    }
    await audit(user.id, id ? "update" : "create", "CashAccount", id ?? undefined);
    return "Đã lưu.";
  }, PATHS);
}

export async function saveCategory(id: number | null, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const direction = f.get("direction") === "IN" ? "IN" : "OUT";
    const acc = req(f, "ledger", "tài khoản hạch toán");
    const data = { name: req(f, "name", "tên"), direction: direction as "IN" | "OUT", debitAccount: direction === "OUT" ? acc : null, creditAccount: direction === "IN" ? acc : null };
    if (id) await db.txnCategory.update({ where: { id }, data });
    else await db.txnCategory.create({ data: { ...data, code: req(f, "code", "mã").toUpperCase(), order: 100 } });
    await audit(user.id, id ? "update" : "create", "TxnCategory", id ? String(id) : undefined);
    return "Đã lưu khoản mục.";
  }, PATHS);
}

export async function deleteCategory(id: number, _: ActionResult) {
  return run(async () => {
    await requirePermission("accounting.post");
    const n = (await db.cashTxn.count({ where: { categoryId: id } })) + (await db.payable.count({ where: { categoryId: id } }));
    if (n) throw new UserError(`Khoản mục đã dùng trong ${n} chứng từ nên không xóa được, chỉ đổi tên.`);
    await db.txnCategory.delete({ where: { id } });
    return "Đã xóa khoản mục.";
  }, PATHS);
}

export async function saveSupplier(id: string | null, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const data = { name: req(f, "name", "tên"), phone: opt(f, "phone"), taxCode: opt(f, "taxCode"), note: opt(f, "note") };
    if (id) await db.supplier.update({ where: { id }, data });
    else await db.supplier.create({ data: { ...data, code: req(f, "code", "mã").toUpperCase() } });
    await audit(user.id, id ? "update" : "create", "Supplier", id ?? undefined);
    return "Đã lưu nhà cung cấp.";
  }, PATHS);
}

export async function deleteSupplier(id: string, _: ActionResult) {
  return run(async () => {
    await requirePermission("accounting.post");
    const n = (await db.cashTxn.count({ where: { supplierId: id } })) + (await db.payable.count({ where: { supplierId: id } }));
    if (n) throw new UserError(`Nhà cung cấp đã có ${n} chứng từ nên không xóa được.`);
    await db.supplier.delete({ where: { id } });
    return "Đã xóa nhà cung cấp.";
  }, PATHS);
}

/** Kiểm quỹ: ghi số tiền đếm thực tế cuối ngày (ghi đè nếu đã kiểm). */
export async function saveCashCount(accountId: string, d: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("accounting.post");
    const counted = int(f, "counted", "số tiền đếm được");
    if (counted === null || counted < 0) throw new UserError("Nhập số tiền đếm được.", "counted");
    const note = opt(f, "note");
    await db.cashCount.upsert({ where: { accountId_date: { accountId, date: toDate(d) } }, update: { counted, note }, create: { accountId, date: toDate(d), counted, note } });
    await audit(user.id, "count", "CashAccount", accountId, { day: d, counted });
    return "Đã lưu kết quả kiểm quỹ.";
  }, PATHS);
}
