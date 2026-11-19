/**
 * Dữ liệu mẫu bổ sung cho Báo cáo kế toán: thu chi lặt vặt hằng ngày, phí ngân hàng, kiểm quỹ cuối ngày,
 * ngân sách chi phí, hóa đơn nhà cung cấp quá hạn / sắp đến hạn.
 * Chạy một lần (đánh dấu bằng Setting "seed.reportExtras") nên cũng thêm được vào database đã có dữ liệu.
 */
import type { PrismaClient } from "@prisma/client";
import { postEntry, type EntryLine } from "../src/lib/accounting/posting";
import { nextCashCode } from "../src/lib/accounting/vouchers";
import { addDays, toDate, toDay, weekday } from "../src/lib/dates";
import { roundTo } from "../src/lib/money";

const MARK = "seed.reportExtras";

export const BUDGET: Record<string, number> = {
  CHI_THUE: 25_000_000, CHI_DIEN: 5_000_000, CHI_NET: 1_000_000, CHI_MKT: 10_000_000, CHI_VPP: 2_000_000,
  CHI_SUA: 1_500_000, CHI_GT: 13_000_000, CHI_KHAC: 3_000_000,
};

export async function seedReportExtras(db: PrismaClient, rand: () => number, today: string) {
  if (await db.setting.findUnique({ where: { key: MARK } })) return;
  const acc = Object.fromEntries((await db.cashAccount.findMany()).map((a) => [a.code, a]));
  const cat = Object.fromEntries((await db.txnCategory.findMany()).map((c) => [c.code, c]));
  const sup = Object.fromEntries((await db.supplier.findMany()).map((s) => [s.code, s]));
  if (!acc.TM || !cat.CHI_KHAC) return; // chưa có dữ liệu kế toán nền

  async function txn(o: { type: "IN" | "OUT"; day: string; account: string; category: string; amount: number; description: string; counterparty?: string; supplierId?: string; other: EntryLine }) {
    if (o.day > today || o.amount <= 0) return;
    const a = acc[o.account];
    const vType = o.type === "IN" ? (a.kind === "BANK" ? "BC" : "PT") : a.kind === "BANK" ? "BN" : "PC";
    const code = await nextCashCode(db, vType, o.day);
    const t = await db.cashTxn.create({
      data: { code, type: o.type, date: toDate(o.day), accountId: a.id, categoryId: cat[o.category].id, amount: o.amount, description: o.description, counterparty: o.counterparty, supplierId: o.supplierId },
    });
    const cash: EntryLine = { accountCode: a.ledgerCode, cashAccountId: a.id, [o.type === "IN" ? "debit" : "credit"]: o.amount };
    const other: EntryLine = { ...o.other, [o.type === "IN" ? "credit" : "debit"]: o.amount };
    await postEntry(db, { date: toDate(o.day), voucherType: vType, voucherNo: code, description: o.description, sourceType: "CashTxn", sourceId: t.id, lines: o.type === "IN" ? [cash, other] : [other, cash] });
  }

  // 1. Thu chi lặt vặt bằng tiền mặt gần như mỗi ngày làm việc từ 01/09.
  const PETTY_OUT = [
    ["CHI_VPP", "Photo tài liệu, đề thi thử", 80_000, 250_000],
    ["CHI_KHAC", "Nước uống cho học viên", 60_000, 180_000],
    ["CHI_KHAC", "Gửi xe, giao nhận tài liệu", 30_000, 90_000],
    ["CHI_VPP", "Mực in, giấy A4", 150_000, 400_000],
    ["CHI_SUA", "Sửa ổ điện, thay bóng đèn", 120_000, 350_000],
  ] as const;
  const PETTY_IN = [
    ["THU_GT", "Bán giáo trình HSK cho học viên", 120_000, 360_000],
    ["THU_GT", "Bán sách IELTS Mindset", 180_000, 540_000],
    ["THU_GT", "Thu phí thi thử", 150_000, 450_000],
    ["THU_KHAC", "Thu tiền in chứng nhận, photo hộ", 20_000, 80_000],
  ] as const;
  for (let d = "2026-09-01"; d <= today; d = addDays(d, 1)) {
    if (weekday(d) === 0) continue;
    if (rand() < 0.7) {
      const [c, desc, lo, hi] = PETTY_OUT[Math.floor(rand() * PETTY_OUT.length)];
      await txn({ type: "OUT", day: d, account: "TM", category: c, amount: roundTo(lo + rand() * (hi - lo), 10_000), description: desc, other: { accountCode: cat[c].debitAccount! } });
    }
    if (rand() < 0.45) {
      const [c, desc, lo, hi] = PETTY_IN[Math.floor(rand() * PETTY_IN.length)];
      await txn({ type: "IN", day: d, account: "TM", category: c, amount: roundTo(lo + rand() * (hi - lo), 10_000), description: desc, other: { accountCode: cat[c].creditAccount! } });
    }
  }

  // 2. Phí quản lý tài khoản, phí SMS ngân hàng cuối mỗi tháng.
  for (const m of ["2026-09", "2026-10"]) {
    for (const code of ["VCB", "TCB"]) {
      if (!acc[code]) continue;
      await txn({ type: "OUT", day: `${m}-${m === "2026-09" ? 30 : 31}`, account: code, category: "CHI_KHAC", amount: code === "VCB" ? 33_000 : 22_000, description: `Phí quản lý tài khoản, SMS Banking tháng ${m.slice(5)}`, counterparty: acc[code].bankName ?? undefined, other: { accountCode: "6422" } });
    }
  }

  // 3. Hóa đơn nhà cung cấp: một hóa đơn quá hạn chưa trả, một hóa đơn sắp đến hạn.
  const bills = [
    { sup: "NCC-VPP", cat: "CHI_VPP", desc: "In tài liệu, đề thi thử tháng 10", amount: 3_450_000, bill: "2026-10-20", due: "2026-11-10" },
    { sup: "NCC-META", cat: "CHI_MKT", desc: "Quảng cáo tuyển sinh khóa tháng 12 (trả sau)", amount: 6_000_000, bill: "2026-11-15", due: addDays(today, 5) },
  ];
  for (const [i, b] of bills.entries()) {
    if (!sup[b.sup] || b.bill > today) continue;
    const code = `MH${b.bill.slice(2, 4)}${b.bill.slice(5, 7)}-${String(90 + i).padStart(4, "0")}`;
    const p = await db.payable.create({ data: { code, supplierId: sup[b.sup].id, categoryId: cat[b.cat].id, description: b.desc, amount: b.amount, billDate: toDate(b.bill), dueDate: toDate(b.due) } });
    await postEntry(db, {
      date: toDate(b.bill), voucherType: "MH", voucherNo: code, description: b.desc, sourceType: "Payable", sourceId: p.id,
      lines: [{ accountCode: cat[b.cat].debitAccount!, debit: b.amount }, { accountCode: "331", credit: b.amount, supplierId: sup[b.sup].id }],
    });
  }

  // 4. Kiểm quỹ tiền mặt cuối ngày trong 3 tuần gần nhất (thỉnh thoảng lệch vài chục nghìn).
  const cash = acc.TM;
  const rows = await db.cashTxn.findMany({ where: { voidedAt: null, OR: [{ accountId: cash.id }, { toAccountId: cash.id }] }, select: { date: true, type: true, amount: true, accountId: true, toAccountId: true } });
  const balanceAt = (d: string) => cash.openingBalance + rows.filter((t) => toDay(t.date) <= d).reduce((s, t) => s + (t.type === "TRANSFER" ? (t.toAccountId === cash.id ? t.amount : -t.amount) : t.type === "IN" ? t.amount : -t.amount), 0);
  for (let d = addDays(today, -21); d < today; d = addDays(d, 1)) {
    if (weekday(d) === 0) continue;
    const r = rand();
    const diff = r < 0.12 ? -50_000 : r < 0.18 ? 20_000 : 0;
    await db.cashCount.create({ data: { accountId: cash.id, date: toDate(d), counted: balanceAt(d) + diff, note: diff < 0 ? "Thiếu tiền lẻ, đang kiểm tra lại phiếu" : diff > 0 ? "Thừa, chưa rõ nguồn" : null } });
  }

  // 5. Ngân sách chi phí hằng tháng (dùng cho báo cáo chi phí).
  await db.setting.upsert({ where: { key: "budget.monthly" }, update: {}, create: { key: "budget.monthly", value: BUDGET } });
  await db.setting.create({ data: { key: MARK, value: today } });

  // Số chứng từ đánh lại theo ngày cho gọn.
  const { renumberByDate } = await import("./seed-accounting");
  await renumberByDate(db);
  console.log("Dữ liệu mẫu báo cáo: đã thêm thu chi lặt vặt, kiểm quỹ, ngân sách, hóa đơn NCC.");
}
