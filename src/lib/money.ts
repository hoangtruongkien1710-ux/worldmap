export function money(n: number | null | undefined): string {
  return `${Number(n ?? 0).toLocaleString("vi-VN")}đ`;
}

export function shortMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  }
  return money(n);
}

/** Làm tròn đến bội số `step` (mặc định 1.000đ). */
export function roundTo(n: number, step = 1000): number {
  return Math.round(n / step) * step;
}
