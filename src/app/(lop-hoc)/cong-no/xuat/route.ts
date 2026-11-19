import { auth } from "@/auth";
import { can } from "@/lib/auth/permissions";
import { monthOf, todayVN } from "@/lib/dates";
import { debtRows, monthShort, tuitionSheets } from "@/lib/tuition/month";
import { xlsxResponse } from "@/lib/xlsx";

export async function GET() {
  const session = await auth();
  if (!can(session?.user?.role, "tuition.view")) return new Response("Không có quyền", { status: 403 });
  const current = monthOf(todayVN());
  const rows = debtRows(await tuitionSheets(), current);
  return xlsxResponse(`cong-no-${todayVN()}.xlsx`, [
    {
      name: "Công nợ theo học viên", widths: [10, 26, 22, 14, 14, 10, 16, 16],
      rows: [["Mã HV", "Học viên", "Phụ huynh", "SĐT phụ huynh", "SĐT học viên", "Số tháng", "Nợ tháng trước", "Tổng nợ"],
        ...rows.map((r) => [r.student.code, r.student.fullName, r.student.parentName, r.student.parentPhone, r.student.phone, r.sheets.length, r.overdue, r.total])],
    },
    {
      name: "Chi tiết nợ", widths: [10, 26, 10, 26, 14, 14, 14],
      rows: [["Mã HV", "Học viên", "Tháng", "Lớp", "Thành tiền", "Đã thu", "Còn nợ"],
        ...rows.flatMap((r) => r.sheets.flatMap((s) => s.items.filter((i) => i.remain > 0).map((i) => [r.student.code, r.student.fullName, monthShort(s.month), i.className, i.amount, i.paid, i.remain])))],
    },
  ]);
}
