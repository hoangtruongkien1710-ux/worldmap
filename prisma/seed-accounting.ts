/**
 * Dữ liệu mẫu cho phân hệ Kế toán: quỹ, ngân hàng, thu học phí, chi phí, nhà cung cấp, lương, bút toán.
 * Mọi chứng từ đều sinh bút toán kép qua postEntry nên sổ luôn cân. Chạy lại không nhân đôi dữ liệu.
 */
import type { PrismaClient } from "@prisma/client";
import { CHART_OF_ACCOUNTS, postEntry, type EntryLine } from "../src/lib/accounting/posting";
import { addDays, monthRange, shiftMonth, toDate, toDay } from "../src/lib/dates";
import { roundTo } from "../src/lib/money";

const START = "2026-09-01"; // ngày bắt đầu dùng phần mềm kế toán (số dư đầu kỳ)

const CASH_ACCOUNTS = [
  { code: "TM", name: "Quỹ tiền mặt", kind: "CASH" as const, ledgerCode: "1111", openingBalance: 50_000_000 },
  { code: "VCB", name: "Vietcombank – TK thu học phí", kind: "BANK" as const, bankName: "Vietcombank", accountNo: "1023 456 789", ledgerCode: "1121", openingBalance: 320_000_000 },
  { code: "TCB", name: "Techcombank – TK chi", kind: "BANK" as const, bankName: "Techcombank", accountNo: "1903 5566 7788", ledgerCode: "1121", openingBalance: 150_000_000 },
];

const CATEGORIES = [
  { code: "THU_HP", name: "Thu học phí", direction: "IN" as const, creditAccount: "131" },
  { code: "THU_GT", name: "Thu tiền giáo trình, phí thi thử", direction: "IN" as const, creditAccount: "5118" },
  { code: "THU_KHAC", name: "Thu khác", direction: "IN" as const, creditAccount: "711" },
  { code: "CHI_THUE", name: "Thuê mặt bằng", direction: "OUT" as const, debitAccount: "6422" },
  { code: "CHI_DIEN", name: "Điện, nước", direction: "OUT" as const, debitAccount: "6422" },
  { code: "CHI_NET", name: "Internet, phần mềm", direction: "OUT" as const, debitAccount: "6422" },
  { code: "CHI_MKT", name: "Marketing, quảng cáo", direction: "OUT" as const, debitAccount: "6421" },
  { code: "CHI_VPP", name: "Văn phòng phẩm", direction: "OUT" as const, debitAccount: "6422" },
  { code: "CHI_SUA", name: "Sửa chữa, bảo trì", direction: "OUT" as const, debitAccount: "6422" },
  { code: "CHI_GT", name: "Mua giáo trình, tài liệu", direction: "OUT" as const, debitAccount: "632" },
  { code: "CHI_LUONG", name: "Trả lương", direction: "OUT" as const, debitAccount: "334" },
  { code: "CHI_BH", name: "Nộp bảo hiểm", direction: "OUT" as const, debitAccount: "3383" },
  { code: "CHI_NCC", name: "Trả nhà cung cấp", direction: "OUT" as const, debitAccount: "331" },
  { code: "CHI_KHAC", name: "Chi khác", direction: "OUT" as const, debitAccount: "811" },
];

const SUPPLIERS = [
  { code: "NCC-NHA", name: "Bà Nguyễn Thị Lan (chủ nhà)", phone: "0912 000 111", note: "Thuê tầng 1–3, thanh toán ngày 5 hằng tháng" },
  { code: "NCC-EVN", name: "Điện lực Bắc Giang", taxCode: "0100100079-012" },
  { code: "NCC-FPT", name: "FPT Telecom", taxCode: "0101778163" },
  { code: "NCC-FAHASA", name: "Nhà sách Fahasa", taxCode: "0304132047", note: "Giáo trình HSK, Mindset, TOEIC – trả chậm 30 ngày" },
  { code: "NCC-META", name: "Meta Platforms (quảng cáo Facebook)" },
  { code: "NCC-VPP", name: "Văn phòng phẩm Hồng Hà" },
];

/** Thù lao giáo viên theo buổi (mock). */
const RATE: Record<string, number> = { HSK: 300_000, IELTS: 450_000, TOEIC: 400_000, ONE_ON_ONE: 600_000 };

const OFFICE = [
  { code: "NV-QL01", userKey: "quanly", fullName: "Phạm Thị Hoa", position: "Quản lý trung tâm", base: 12_000_000, allowance: 1_000_000 },
  { code: "NV-KT01", userKey: "ketoan", fullName: "Đỗ Thu Trang", position: "Kế toán", base: 11_000_000, allowance: 500_000 },
  { code: "NV-LT01", userKey: null, fullName: "Hoàng Thị Mai", position: "Lễ tân – tư vấn", base: 7_000_000, allowance: 500_000 },
];

export async function seedAccounting(db: PrismaClient, rand: () => number, today: string) {
  for (const a of CHART_OF_ACCOUNTS) {
    await db.ledgerAccount.upsert({ where: { code: a.code }, update: { name: a.name, parentCode: a.parentCode, type: a.type }, create: a });
  }
  if ((await db.journalEntry.count()) > 0) {
    console.log("Kế toán: đã có bút toán, bỏ qua phần dữ liệu mẫu kế toán.");
    return;
  }

  const acc: Record<string, { id: string; ledgerCode: string; name: string }> = {};
  for (const a of CASH_ACCOUNTS) {
    const row = await db.cashAccount.upsert({ where: { code: a.code }, update: {}, create: { ...a, openingDate: toDate(START) } });
    acc[a.code] = row;
  }
  const cat: Record<string, number> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await db.txnCategory.upsert({ where: { code: c.code }, update: { name: c.name }, create: { ...c, order: i } });
    cat[c.code] = row.id;
  }
  const sup: Record<string, string> = {};
  for (const s of SUPPLIERS) sup[s.code] = (await db.supplier.upsert({ where: { code: s.code }, update: {}, create: s })).id;

  const users = await db.user.findMany();
  const uid = (u: string) => users.find((x) => x.username === u)?.id;
  const collector = uid("ketoan") ?? users[0].id;

  // ---- Đánh số chứng từ: PT2611-0001 ----
  const counters = new Map<string, number>();
  const nextNo = (type: string, day: string) => {
    const key = `${type}${day.slice(2, 4)}${day.slice(5, 7)}`;
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    return `${key}-${String(n).padStart(4, "0")}`;
  };

  /** Phiếu thu / chi / báo có / báo nợ: tạo CashTxn rồi ghi bút toán. */
  async function cashTxn(o: {
    type: "IN" | "OUT"; day: string; account: string; category: string; amount: number; description: string;
    counterparty?: string; supplierId?: string; studentId?: string; paymentId?: string; payrollPeriodId?: string;
    other: EntryLine; // dòng đối ứng
  }) {
    if (o.day > today || o.amount <= 0) return null;
    const a = acc[o.account];
    const isBank = o.account !== "TM";
    const vType = o.type === "IN" ? (isBank ? "BC" : "PT") : isBank ? "BN" : "PC";
    const code = nextNo(vType, o.day);
    const txn = await db.cashTxn.create({
      data: {
        code, type: o.type, date: toDate(o.day), accountId: a.id, categoryId: cat[o.category], amount: o.amount,
        description: o.description, counterparty: o.counterparty, supplierId: o.supplierId, studentId: o.studentId,
        paymentId: o.paymentId, payrollPeriodId: o.payrollPeriodId,
      },
    });
    const cashLine: EntryLine = { accountCode: a.ledgerCode, cashAccountId: a.id, [o.type === "IN" ? "debit" : "credit"]: o.amount };
    const otherLine: EntryLine = { ...o.other, [o.type === "IN" ? "credit" : "debit"]: o.amount };
    await postEntry(db, {
      date: toDate(o.day), voucherType: vType, voucherNo: code, description: o.description,
      sourceType: "CashTxn", sourceId: txn.id, lines: o.type === "IN" ? [cashLine, otherLine] : [otherLine, cashLine],
    });
    return txn;
  }

  // ---- 1. Số dư đầu kỳ 01/09/2026 ----
  await postEntry(db, {
    date: toDate(START), voucherType: "NVK", voucherNo: "SDDK-2609", description: "Số dư đầu kỳ khi bắt đầu dùng phần mềm",
    sourceType: "OPENING",
    lines: [
      ...CASH_ACCOUNTS.map((a) => ({ accountCode: a.ledgerCode, cashAccountId: acc[a.code].id, debit: a.openingBalance })),
      { accountCode: "411", credit: 400_000_000 },
      { accountCode: "421", credit: CASH_ACCOUNTS.reduce((s, a) => s + a.openingBalance, 0) - 400_000_000 },
    ],
  });

  // ---- 2. Học phí: ghi nhận phải thu khi khai giảng, thu tiền theo đợt ----
  const enrollments = await db.enrollment.findMany({
    include: { student: true, class: { include: { course: { include: { program: true } }, sessions: { where: { status: "SCHEDULED" }, select: { date: true } } } } },
    orderBy: [{ joinDate: "asc" }],
  });
  const invoiceTotals = new Map<string, { id: string; amount: number; items: unknown[] }>();
  for (const e of enrollments) {
    const c = e.class;
    const start = toDay(e.joinDate);
    if (start > today) continue;
    let gross = c.unitPrice;
    let detail = `${c.name}`;
    if (c.feeMode === "PER_SESSION") {
      const held = c.sessions.filter((s) => toDay(s.date) <= today && toDay(s.date) >= START).length;
      gross = c.unitPrice * held;
      detail = `${c.name} · ${held} buổi`;
    }
    const discount = roundTo((gross * e.percentDiscount) / 100);
    const amount = gross - discount;
    if (amount <= 0) continue;
    const day = start < START ? START : start;
    const month = day.slice(0, 7);

    // Một hóa đơn mỗi học viên mỗi tháng: cộng dồn nếu học 2 lớp khai giảng cùng tháng.
    const key = `${e.studentId}|${month}`;
    let inv = invoiceTotals.get(key);
    const item = { classId: c.id, className: c.name, gross, discount, amount, note: detail };
    if (!inv) {
      const row = await db.invoice.create({
        data: { studentId: e.studentId, month, status: "LOCKED", lockedAmount: amount, lockedDetail: [item], lockedAt: toDate(day), lockedById: collector },
      });
      inv = { id: row.id, amount, items: [item] };
      invoiceTotals.set(key, inv);
    } else {
      inv.amount += amount;
      inv.items.push(item);
      await db.invoice.update({ where: { id: inv.id }, data: { lockedAmount: inv.amount, lockedDetail: inv.items as never } });
    }
    await postEntry(db, {
      date: toDate(day), voucherType: "HP", voucherNo: nextNo("HP", day),
      description: `Ghi nhận học phí ${detail} – ${e.student.fullName}`, sourceType: "Invoice", sourceId: inv.id,
      lines: [
        { accountCode: "131", debit: amount, studentId: e.studentId, classId: c.id },
        { accountCode: "5113", credit: amount, studentId: e.studentId, classId: c.id },
      ],
    });

    // Kịch bản thu: 60% đóng đủ, 25% đóng 2 đợt, 15% mới đặt cọc hoặc chưa đóng.
    const r = rand();
    const plan: { day: string; amount: number }[] = [];
    const firstDay = addDays(day, Math.floor(rand() * 6));
    if (c.feeMode === "PER_SESSION" || start < START || r < 0.6) plan.push({ day: firstDay, amount });
    else if (r < 0.85) {
      const half = roundTo(amount / 2, 100_000);
      plan.push({ day: firstDay, amount: half }, { day: addDays(firstDay, 30), amount: amount - half });
    } else if (rand() < 0.5) plan.push({ day: firstDay, amount: roundTo(amount * 0.3, 100_000) });

    for (const [i, p] of plan.entries()) {
      if (p.day > today) continue;
      const transfer = rand() < 0.8;
      const payment = await db.payment.create({
        data: {
          invoiceId: inv.id, classId: c.id, amount: p.amount, method: transfer ? "TRANSFER" : "CASH", paidAt: toDate(p.day),
          collectedById: collector, idempotencyKey: `seed-${e.id}-${i}`,
          txnRef: transfer ? `FT26${String(Math.floor(rand() * 1e8)).padStart(8, "0")}` : null,
          note: plan.length > 1 ? `Đợt ${i + 1}/${plan.length}` : null,
        },
      });
      await cashTxn({
        type: "IN", day: p.day, account: transfer ? "VCB" : "TM", category: "THU_HP", amount: p.amount,
        description: `Thu học phí ${c.name}${plan.length > 1 ? ` (đợt ${i + 1})` : ""} – ${e.student.fullName}`,
        counterparty: e.student.fullName, studentId: e.studentId, paymentId: payment.id,
        other: { accountCode: "131", studentId: e.studentId, classId: c.id },
      });
    }
  }

  // ---- 3. Chi phí hằng tháng, mua giáo trình, thu khác ----
  const months = ["2026-09", "2026-10", "2026-11"];
  for (const m of months) {
    const d = (n: number) => `${m}-${String(n).padStart(2, "0")}`;
    await cashTxn({ type: "OUT", day: d(5), account: "TCB", category: "CHI_THUE", amount: 25_000_000, description: `Tiền thuê mặt bằng tháng ${m.slice(5)}/${m.slice(0, 4)}`, supplierId: sup["NCC-NHA"], counterparty: "Bà Nguyễn Thị Lan", other: { accountCode: "6422", supplierId: sup["NCC-NHA"] } });
    await cashTxn({ type: "OUT", day: d(10), account: "TCB", category: "CHI_NET", amount: 880_000, description: `Cước internet FPT tháng ${m.slice(5)}`, supplierId: sup["NCC-FPT"], counterparty: "FPT Telecom", other: { accountCode: "6422", supplierId: sup["NCC-FPT"] } });
    await cashTxn({ type: "OUT", day: d(12), account: "TCB", category: "CHI_DIEN", amount: roundTo(3_200_000 + rand() * 1_400_000, 10_000), description: `Tiền điện tháng ${shiftMonth(m, -1).slice(5)}`, supplierId: sup["NCC-EVN"], counterparty: "Điện lực Bắc Giang", other: { accountCode: "6422", supplierId: sup["NCC-EVN"] } });
    await cashTxn({ type: "OUT", day: d(13), account: "TM", category: "CHI_DIEN", amount: roundTo(350_000 + rand() * 150_000, 10_000), description: `Tiền nước tháng ${shiftMonth(m, -1).slice(5)}`, counterparty: "Công ty cấp nước", other: { accountCode: "6422" } });
    await cashTxn({ type: "OUT", day: d(15), account: "TCB", category: "CHI_MKT", amount: roundTo(8_000_000 + rand() * 4_000_000, 100_000), description: `Quảng cáo Facebook tuyển sinh tháng ${m.slice(5)}`, supplierId: sup["NCC-META"], counterparty: "Meta Platforms", other: { accountCode: "6421", supplierId: sup["NCC-META"] } });
    await cashTxn({ type: "OUT", day: d(8), account: "TM", category: "CHI_VPP", amount: roundTo(900_000 + rand() * 700_000, 10_000), description: "Mua văn phòng phẩm, bút, giấy in", supplierId: sup["NCC-VPP"], counterparty: "VPP Hồng Hà", other: { accountCode: "6422", supplierId: sup["NCC-VPP"] } });
    await cashTxn({ type: "OUT", day: d(20), account: "TM", category: "CHI_KHAC", amount: roundTo(500_000 + rand() * 800_000, 10_000), description: "Nước uống, tiếp khách phụ huynh", other: { accountCode: "811" } });
    if (m === "2026-10") await cashTxn({ type: "OUT", day: d(22), account: "TM", category: "CHI_SUA", amount: 2_400_000, description: "Bảo dưỡng điều hòa phòng P.201, P.202", counterparty: "Điện lạnh Minh Phát", other: { accountCode: "6422" } });

    // Bán giáo trình, thu phí thi thử (tiền mặt)
    for (let i = 0; i < 4; i++) {
      await cashTxn({ type: "IN", day: d(6 + i * 5), account: "TM", category: "THU_GT", amount: roundTo(150_000 + rand() * 250_000, 10_000) * (1 + Math.floor(rand() * 4)), description: i % 2 ? "Thu phí thi thử TOEIC/IELTS" : "Bán giáo trình cho học viên", other: { accountCode: "5118" } });
    }

    // Mua giáo trình Fahasa trả chậm 30 ngày: ghi công nợ, trả vào tháng sau
    const billDay = d(3);
    if (billDay <= today) {
      const amount = roundTo(9_000_000 + rand() * 5_000_000, 10_000);
      const code = nextNo("MH", billDay);
      const payable = await db.payable.create({
        data: { code, supplierId: sup["NCC-FAHASA"], categoryId: cat["CHI_GT"], description: `Mua giáo trình tháng ${m.slice(5)}`, amount, billDate: toDate(billDay), dueDate: toDate(addDays(billDay, 30)) },
      });
      await postEntry(db, {
        date: toDate(billDay), voucherType: "MH", voucherNo: code, description: `Mua giáo trình Fahasa tháng ${m.slice(5)}`,
        sourceType: "Payable", sourceId: payable.id,
        lines: [{ accountCode: "632", debit: amount }, { accountCode: "331", credit: amount, supplierId: sup["NCC-FAHASA"] }],
      });
      const payDay = addDays(billDay, 28);
      await cashTxn({ type: "OUT", day: payDay, account: "TCB", category: "CHI_NCC", amount, description: `Thanh toán ${code} – giáo trình tháng ${m.slice(5)}`, supplierId: sup["NCC-FAHASA"], counterparty: "Nhà sách Fahasa", other: { accountCode: "331", supplierId: sup["NCC-FAHASA"] } }).then(async (t) => {
        if (t) await db.cashTxn.update({ where: { id: t.id }, data: { payableId: payable.id } });
      });
    }
  }

  // ---- 4. Chuyển tiền nội bộ: VCB sang TCB để chi, cuối tháng nộp tiền mặt vào VCB ----
  const transfers = [
    { day: "2026-09-25", from: "VCB", to: "TCB", amount: 80_000_000, description: "Chuyển tiền từ TK thu học phí sang TK chi" },
    { day: "2026-10-28", from: "VCB", to: "TCB", amount: 100_000_000, description: "Chuyển tiền từ TK thu học phí sang TK chi (lương tháng 10)" },
  ];
  async function transfer(t: (typeof transfers)[number]) {
    if (t.day > today) return;
    const code = nextNo("CT", t.day);
    const from = acc[t.from];
    const to = acc[t.to];
    const txn = await db.cashTxn.create({
      data: { code, type: "TRANSFER", date: toDate(t.day), accountId: from.id, toAccountId: to.id, amount: t.amount, description: t.description },
    });
    await postEntry(db, {
      date: toDate(t.day), voucherType: "CT", voucherNo: code, description: t.description, sourceType: "CashTxn", sourceId: txn.id,
      lines: [
        { accountCode: to.ledgerCode, debit: t.amount, cashAccountId: to.id },
        { accountCode: from.ledgerCode, credit: t.amount, cashAccountId: from.id },
      ],
    });
  }

  for (const t of transfers) await transfer(t);
  // Cuối tháng nộp tiền mặt thừa vào ngân hàng, giữ lại khoảng 30 triệu trong quỹ.
  for (const m of months) {
    const end = monthRange(m).to;
    if (end > today) continue;
    const rows = await db.cashTxn.findMany({ where: { date: { lte: toDate(end) }, OR: [{ accountId: acc.TM.id }, { toAccountId: acc.TM.id }] } });
    const bal = CASH_ACCOUNTS[0].openingBalance + rows.reduce((s, t) => s + (t.toAccountId === acc.TM.id ? t.amount : t.type === "IN" ? t.amount : -t.amount), 0);
    const amount = Math.floor((bal - 30_000_000) / 1_000_000) * 1_000_000;
    if (amount > 0) await transfer({ day: end, from: "TM", to: "VCB", amount, description: `Nộp tiền mặt thu học phí tháng ${m.slice(5)} vào TK Vietcombank` });
  }

  // ---- 5. Nhân viên và bảng lương tháng 9, 10 (nhập từ file Excel sau khi chốt chấm công) ----
  const teachers = users.filter((u) => u.role === "TEACHER");
  const employees: { id: string; code: string; dept: string; userId?: string | null; base?: number; allowance?: number; fullName: string }[] = [];
  for (const [i, t] of teachers.entries()) {
    const code = `GV-${String(i + 1).padStart(2, "0")}`;
    const row = await db.employee.upsert({ where: { code }, update: {}, create: { code, fullName: t.fullName, department: "GIAO_VIEN", position: "Giáo viên", userId: t.id } });
    employees.push({ id: row.id, code, dept: "GIAO_VIEN", userId: t.id, fullName: t.fullName });
  }
  for (const o of OFFICE) {
    const row = await db.employee.upsert({ where: { code: o.code }, update: {}, create: { code: o.code, fullName: o.fullName, department: "VAN_PHONG", position: o.position, userId: o.userKey ? uid(o.userKey) : null } });
    employees.push({ id: row.id, code: o.code, dept: "VAN_PHONG", base: o.base, allowance: o.allowance, fullName: o.fullName });
  }

  for (const month of ["2026-09", "2026-10"]) {
    const { from, to } = monthRange(month);
    const closeDay = to;
    const payDay = `${shiftMonth(month, 1)}-05`;
    const period = await db.payrollPeriod.create({
      data: { month, status: payDay <= today ? "PAID" : "LOCKED", sourceFile: `bang-luong-${month}.xlsx`, importedAt: toDate(addDays(closeDay, 2)) },
    });
    let teacherGross = 0, officeGross = 0, ins = 0, pit = 0, net = 0;
    for (const e of employees) {
      let base: number, allowance: number, sessions: number | null = null, workDays = 26;
      if (e.dept === "GIAO_VIEN") {
        const ss = await db.session.findMany({
          where: { status: "SCHEDULED", date: { gte: toDate(from), lte: toDate(to) }, class: { teacherId: e.userId! } },
          include: { class: { include: { course: { include: { program: true } } } } },
        });
        sessions = ss.length;
        base = ss.reduce((s, x) => s + (x.class.feeMode === "PER_SESSION" ? RATE.ONE_ON_ONE : RATE[x.class.course?.program.code ?? "IELTS"] ?? 400_000), 0);
        allowance = 300_000; // phụ cấp xăng xe
        workDays = new Set(ss.map((x) => toDay(x.date))).size;
      } else {
        base = e.base!;
        allowance = e.allowance!;
        workDays = 26 - Math.floor(rand() * 2);
      }
      const bonus = rand() < 0.25 ? 500_000 : 0;
      const insurance = e.dept === "VAN_PHONG" ? roundTo(base * 0.105) : 0;
      const gross = base + allowance + bonus;
      const taxable = gross - insurance - 11_000_000;
      const tax = taxable > 0 ? roundTo(taxable * 0.05) : 0;
      const netPay = gross - insurance - tax;
      await db.payrollLine.create({
        data: { periodId: period.id, employeeId: e.id, workDays, teachingSessions: sessions, baseSalary: base, allowance, bonus, insurance, pit: tax, netPay },
      });
      if (e.dept === "GIAO_VIEN") teacherGross += gross; else officeGross += gross;
      ins += insurance; pit += tax; net += netPay;
    }
    await postEntry(db, {
      date: toDate(closeDay), voucherType: "LUONG", voucherNo: `BL${month.slice(2, 4)}${month.slice(5)}`,
      description: `Hạch toán bảng lương tháng ${month.slice(5)}/${month.slice(0, 4)}`, sourceType: "PayrollPeriod", sourceId: period.id,
      lines: [
        { accountCode: "632", debit: teacherGross },
        { accountCode: "6422", debit: officeGross },
        { accountCode: "3383", credit: ins },
        { accountCode: "3335", credit: pit },
        { accountCode: "334", credit: net },
      ],
    });
    await cashTxn({ type: "OUT", day: payDay, account: "TCB", category: "CHI_LUONG", amount: net, description: `Trả lương tháng ${month.slice(5)} cho ${employees.length} nhân sự`, payrollPeriodId: period.id, other: { accountCode: "334" } });
    // Nộp BHXH (phần người lao động 10,5% + phần doanh nghiệp tính vào chi phí 21,5%)
    const companyIns = roundTo((ins / 0.105) * 0.215);
    const insDay = `${shiftMonth(month, 1)}-20`;
    if (insDay <= today) {
      await postEntry(db, {
        date: toDate(closeDay), voucherType: "NVK", voucherNo: `BH${month.slice(2, 4)}${month.slice(5)}`,
        description: `Trích BHXH, BHYT, BHTN phần doanh nghiệp tháng ${month.slice(5)}`, sourceType: "PayrollPeriod", sourceId: period.id,
        lines: [{ accountCode: "6422", debit: companyIns }, { accountCode: "3383", credit: companyIns }],
      });
      await cashTxn({ type: "OUT", day: insDay, account: "TCB", category: "CHI_BH", amount: ins + companyIns, description: `Nộp bảo hiểm xã hội tháng ${month.slice(5)}`, counterparty: "BHXH tỉnh Bắc Giang", other: { accountCode: "3383" } });
    }
  }

  await renumberByDate(db);

  const counts = {
    cashTxns: await db.cashTxn.count(),
    invoices: await db.invoice.count(),
    payments: await db.payment.count(),
    payables: await db.payable.count(),
    payrollLines: await db.payrollLine.count(),
    journalEntries: await db.journalEntry.count(),
  };
  const bal = await db.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  console.log("Kế toán mẫu:", counts, `Tổng Nợ ${bal._sum.debit} = Tổng Có ${bal._sum.credit}`);
}

/** Đánh lại số chứng từ theo thứ tự ngày trong từng tháng (dữ liệu mẫu sinh theo học viên nên lộn thứ tự). */
async function renumberByDate(db: PrismaClient) {
  const key = (code: string) => code.split("-")[0];
  const txns = await db.cashTxn.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  const n = new Map<string, number>();
  const plan = txns.map((t) => {
    const k = key(t.code);
    const i = (n.get(k) ?? 0) + 1;
    n.set(k, i);
    return { id: t.id, old: t.code, code: `${k}-${String(i).padStart(4, "0")}` };
  }).filter((p) => p.code !== p.old);
  for (const p of plan) await db.cashTxn.update({ where: { id: p.id }, data: { code: `TMP-${p.id}` } });
  for (const p of plan) {
    await db.cashTxn.update({ where: { id: p.id }, data: { code: p.code } });
    await db.journalEntry.updateMany({ where: { sourceType: "CashTxn", sourceId: p.id }, data: { voucherNo: `TMP-${p.id}` } });
  }
  for (const p of plan) await db.journalEntry.updateMany({ where: { sourceType: "CashTxn", sourceId: p.id }, data: { voucherNo: p.code } });

  const hp = await db.journalEntry.findMany({ where: { voucherType: "HP" }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  const m = new Map<string, number>();
  const plan2 = hp.map((e) => {
    const k = key(e.voucherNo);
    const i = (m.get(k) ?? 0) + 1;
    m.set(k, i);
    return { id: e.id, code: `${k}-${String(i).padStart(4, "0")}` };
  });
  for (const p of plan2) await db.journalEntry.update({ where: { id: p.id }, data: { voucherNo: `TMP-${p.id}` } });
  for (const p of plan2) await db.journalEntry.update({ where: { id: p.id }, data: { voucherNo: p.code } });
}
