import { db } from "@/lib/db";
import { bookSheets, canExport, fileName, queryOf } from "@/lib/accounting/export";
import { cashBook } from "@/lib/accounting/queries";
import { BOOK_SORT_COLS } from "@/lib/accounting/book-sort";
import { pickPeriod } from "@/lib/accounting/period";
import { parseSort } from "@/lib/sort";
import { xlsxResponse } from "@/lib/xlsx";

export async function GET(req: Request) {
  if (!(await canExport("accounting.view"))) return new Response("Không có quyền", { status: 403 });
  const sp = queryOf(req);
  const period = pickPeriod(sp);
  const acc = await db.cashAccount.findFirst({ where: { kind: "CASH", active: true }, orderBy: { code: "asc" } });
  if (!acc) return new Response("Chưa khai báo quỹ tiền mặt", { status: 404 });
  const book = await cashBook(acc.id, period.from, period.to);
  return xlsxResponse(fileName("so-quy", period), bookSheets("Sổ quỹ", acc.name, period, book, parseSort(sp, BOOK_SORT_COLS)));
}
