import { sortRows, type SortState } from "@/lib/sort";
import type { BookRow } from "@/components/accounting/ui";

const BOOK_SORT: Record<string, (r: BookRow) => string | number> = {
  ngay: (r) => `${r.date}|${r.code}`, so: (r) => r.code, dg: (r) => r.description,
  thu: (r) => r.in, chi: (r) => r.out, ton: (r) => r.balance,
};
export const BOOK_SORT_COLS = Object.keys(BOOK_SORT);

/** Thứ tự hiển thị sổ: theo cột đang chọn; chưa chọn thì mới nhất trước. `rows` đang theo thứ tự cũ → mới. */
export const orderBook = (rows: BookRow[], sort: SortState) => (sort.col ? sortRows(rows, sort, BOOK_SORT) : [...rows].reverse());
