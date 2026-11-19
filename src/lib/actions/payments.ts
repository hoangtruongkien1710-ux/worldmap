"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { recordPayment, voidPayment } from "@/lib/tuition/service";
import { money } from "@/lib/money";
import type { ActionResult } from "@/components/ui/modal";
import { audit, day, int, opt, req, run, str } from "./util";

const PATHS = ["/lop-hoc", "/hoc-phi", "/cong-no", "/hoc-sinh", "/ke-toan"];

/** Thu học phí: mỗi lần bấm “Thu” lưu một lần thu riêng, thu được nhiều lần cho đến khi đủ. */
export async function collectPayment(enrollmentId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const user = await requirePermission("tuition.collect");
    const amount = int(f, "amount", "số tiền") ?? 0;
    const method = str(f, "method") === "CASH" ? "CASH" : "TRANSFER";
    const accountId = req(f, "accountId", "quỹ / tài khoản nhận tiền");
    const p = await db.$transaction((tx) =>
      recordPayment(tx, {
        enrollmentId, amount, method, accountId, day: day(f, "paidAt", "ngày thu"), note: opt(f, "note"), txnRef: opt(f, "txnRef"),
        actorId: user.id, idempotencyKey: req(f, "idempotencyKey", "mã giao dịch"),
      }),
    );
    await audit(user.id, "collect", "Payment", p.id, { amount });
    return `Đã thu ${money(amount)}.`;
  }, PATHS);
}

export async function cancelPayment(paymentId: string, _: ActionResult) {
  return run(async () => {
    const user = await requirePermission("tuition.collect");
    await db.$transaction((tx) => voidPayment(tx, paymentId));
    await audit(user.id, "void", "Payment", paymentId);
    return "Đã hủy lần thu và phiếu thu tương ứng.";
  }, PATHS);
}

/** Thu từ phiếu gộp: chọn lớp (ghi danh) ngay trong form. */
export async function collectFromSheet(_: ActionResult, f: FormData) {
  const enrollmentId = str(f, "enrollmentId");
  if (!enrollmentId) return { ok: false, error: "Chọn lớp cần thu.", at: Date.now() };
  return collectPayment(enrollmentId, _, f);
}
