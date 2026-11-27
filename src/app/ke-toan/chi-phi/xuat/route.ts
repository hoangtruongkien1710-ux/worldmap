import { canExport, expenseSheets, fileName, queryOf } from "@/lib/accounting/export";
import { loadExpenses } from "@/lib/accounting/loaders";
import { xlsxResponse } from "@/lib/xlsx";

export async function GET(req: Request) {
  if (!(await canExport("accounting.view"))) return new Response("Không có quyền", { status: 403 });
  const d = await loadExpenses(queryOf(req));
  return xlsxResponse(fileName("chi-phi", d.period), expenseSheets(d));
}
