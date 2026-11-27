import { canExport, payrollTemplate } from "@/lib/accounting/export";
import { todayVN } from "@/lib/dates";
import { xlsxResponse } from "@/lib/xlsx";

/** Tải file Excel mẫu bảng lương (tháng hiện tại). */
export async function GET() {
  if (!(await canExport("payroll.view"))) return new Response("Không có quyền", { status: 403 });
  const month = todayVN().slice(0, 7);
  return xlsxResponse(`mau-bang-luong-${month}.xlsx`, payrollTemplate(month));
}
