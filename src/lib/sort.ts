export type Dir = "tang" | "giam";
export type SortState = { col?: string; dir?: Dir };

/** Đọc ?xep=<cột>&chieu=tang|giam. Cột lạ hoặc thiếu = không sắp xếp (dùng thứ tự mặc định của trang). */
export function parseSort(sp: Record<string, string | undefined>, allowed: string[], keys: [string, string] = ["xep", "chieu"]): SortState {
  const col = sp[keys[0]];
  if (!col || !allowed.includes(col)) return {};
  return { col, dir: sp[keys[1]] === "giam" ? "giam" : "tang" };
}

type Val = string | number | Date | null | undefined;

/** Sắp xếp theo cột đang chọn; giá trị trống luôn xếp cuối. Không có cột = giữ nguyên thứ tự. */
export function sortRows<T>(rows: T[], s: SortState, get: Record<string, (r: T) => Val>): T[] {
  if (!s.col || !get[s.col]) return rows;
  const f = get[s.col];
  const sign = s.dir === "giam" ? -1 : 1;
  const key = (v: Val) => (v instanceof Date ? v.getTime() : v);
  return rows
    .map((r, i) => ({ r, i, v: key(f(r)) }))
    .sort((a, b) => {
      const an = a.v === null || a.v === undefined || a.v === "";
      const bn = b.v === null || b.v === undefined || b.v === "";
      if (an || bn) return an === bn ? a.i - b.i : an ? 1 : -1;
      const c = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : String(a.v).localeCompare(String(b.v), "vi", { numeric: true });
      return c * sign || a.i - b.i;
    })
    .map((x) => x.r);
}
