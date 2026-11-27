import { canExport, payrollSheets, queryOf } from "@/lib/accounting/export";
import { loadPayroll } from "@/lib/accounting/loaders";
import { xlsxResponse } from "@/lib/xlsx";

export async function GET(req: Request) {
  if (!(await canExport("payroll.view"))) return new Response("Không có quyền", { status: 403 });
  const d = await loadPayroll(queryOf(req));
  if (!d) return new Response("Chưa có bảng lương", { status: 404 });
  return xlsxResponse(`tien-luong-${d.period.month}.xlsx`, payrollSheets(d));
}
