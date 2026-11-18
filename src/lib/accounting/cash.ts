export type Txn = { type: "IN" | "OUT" | "TRANSFER"; amount: number; accountId: string; toAccountId: string | null };

/** Ảnh hưởng của một chứng từ lên số dư của tài khoản tiền `accountId`. */
export function signedFor(t: Txn, accountId: string): number {
  if (t.type === "TRANSFER") return t.toAccountId === accountId ? t.amount : t.accountId === accountId ? -t.amount : 0;
  if (t.accountId !== accountId) return 0;
  return t.type === "IN" ? t.amount : -t.amount;
}

