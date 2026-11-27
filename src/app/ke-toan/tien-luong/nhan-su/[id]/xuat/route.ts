import { canExport, queryOf } from "@/lib/accounting/export";
import { loadStaffDetail } from "@/lib/accounting/loaders";
import { xlsxResponse } from "@/lib/xlsx";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await canExport("payroll.view"))) return new Response("Không có quyền", { status: 403 });
  const d = await loadStaffDetail((await ctx.params).id, queryOf(req));
  if (!d) return new Response("Không tìm thấy nhân sự", { status: 404 });
  const rows = d.lines.slice().reverse();
  return xlsxResponse(`luong-${d.e.code}${d.nam ? `-${d.nam}` : ""}.xlsx`, [{
    name: d.e.code, widths: [12, 14, 12, 10, 14, 14, 14, 14],
    rows: [["Tháng", "Định mức", "Ngày công", "Buổi dạy", "Lương chính", "Thay đổi lương chính", "Tổng lương", "Thực lĩnh"],
      ...rows.map((l) => [`${l.month.slice(5)}/${l.month.slice(0, 4)}`, l.salaryNorm || null, l.workDays, l.sessions, l.baseSalary, l.dBase || null, l.gross, l.netPay])],
  }]);
}
