import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/auth/permissions";
import { monthOf, todayVN } from "@/lib/dates";
import { filterSheets, tuitionSheets } from "@/lib/tuition/month";
import { xlsxResponse } from "@/lib/xlsx";

const STATUS = { paid: "Đã thu đủ", part: "Thu một phần", unpaid: "Chưa thu" };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!can(session?.user?.role, "tuition.view")) return new Response("Không có quyền", { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const month = /^\d{4}-\d{2}$/.test(sp.thang ?? "") ? sp.thang : monthOf(todayVN());
  const sheets = filterSheets(await tuitionSheets(month), sp);
  return xlsxResponse(`hoc-phi-${month}.xlsx`, [
    {
      name: "Phiếu theo học viên", widths: [10, 26, 10, 22, 14, 14, 50, 14, 14, 14, 14],
      rows: [["Mã HV", "Học viên", "Khối", "Phụ huynh", "SĐT phụ huynh", "SĐT học viên", "Các lớp", "Tổng tiền", "Đã thu", "Còn lại", "Trạng thái"],
        ...sheets.map((s) => [s.student.code, s.student.fullName, s.student.grade?.name, s.student.parentName, s.student.parentPhone, s.student.phone,
          s.items.map((i) => i.className).join(", "), s.total, s.paid, s.remain, STATUS[s.status]])],
    },
    {
      name: "Chi tiết theo lớp", widths: [10, 26, 24, 50, 14, 14, 14, 14],
      rows: [["Mã HV", "Học viên", "Lớp", "Cách tính", "Gốc", "Ưu đãi", "Thành tiền", "Đã thu", "Còn lại"],
        ...sheets.flatMap((s) => s.items.map((i) => [s.student.code, s.student.fullName, i.className, i.how, i.gross, i.discount, i.amount, i.paid, i.remain]))],
    },
  ]);
}
