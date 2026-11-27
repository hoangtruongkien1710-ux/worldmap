import { canExport, feeSheets, fileName, queryOf } from "@/lib/accounting/export";
import { loadFees } from "@/lib/accounting/loaders";
import { xlsxResponse } from "@/lib/xlsx";

export async function GET(req: Request) {
  if (!(await canExport("accounting.view"))) return new Response("Không có quyền", { status: 403 });
  const d = await loadFees(queryOf(req));
  return xlsxResponse(fileName("hoc-phi", d.period), feeSheets(d));
}
