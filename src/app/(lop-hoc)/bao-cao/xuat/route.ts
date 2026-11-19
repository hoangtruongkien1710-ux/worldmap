import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/auth/permissions";
import { monthOf, todayVN, toDay } from "@/lib/dates";
import { monthShort } from "@/lib/tuition/month";
import { classroomReport } from "@/lib/tuition/report";
import { xlsxResponse } from "@/lib/xlsx";

const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!can(session?.user?.role, "report.view")) return new Response("Không có quyền", { status: 403 });
  const t = req.nextUrl.searchParams.get("thang") ?? "";
  const month = /^\d{4}-\d{2}$/.test(t) ? t : monthOf(todayVN());
  const r = await classroomReport(month);
  const m = monthShort(month), p = monthShort(r.prevMonth);
  return xlsxResponse(`bao-cao-${month}.xlsx`, [
    { name: "Doanh thu", widths: [28, 10, 16, 16, 16, 16, 16, 10],
      rows: [["Lớp", "Lượt học", `Phải thu ${m}`, `Phải thu ${p}`, "Chênh lệch", "Đã thu", "Còn nợ", "Tỉ lệ thu %"],
        ...r.revenue.rows.map((x) => [x.name, x.n, x.due, x.prevDue, x.due - x.prevDue, x.paid, x.remain, x.due ? r1((x.paid / x.due) * 100) : null]),
        [], ["Tháng", "Phải thu", "Thực thu"], ...r.revenue.trend.map((x) => [monthShort(x.month), x.due, x.cash])] },
    { name: "Chuyên cần", widths: [28, 12, 14, 10, 10, 12, 12, 12],
      rows: [["Lớp", "Buổi đã dạy", "Lượt điểm danh", "Có mặt", "Có phép", "Không phép", `Tỉ lệ ${p} %`, `Tỉ lệ ${m} %`],
        ...r.attendance.rows.map((x) => [x.name, x.sessions, x.marks, x.present, x.excused, x.absent, r1(x.prevRate), r1(x.rate)])] },
    { name: "Học viên", widths: [10, 26, 14, 14, 14, 30, 12],
      rows: [["Mã HV", "Học viên", "Loại", "SĐT phụ huynh", "SĐT học viên", "Lớp", "Ngày"],
        ...r.students.newStudents.map((x) => [x.code, x.fullName, "Mới vào", x.parentPhone, x.phone, "", toDay(r.students.joinedAt(x.id)!)]),
        ...r.students.left.map((x) => [x.student.code, x.student.fullName, "Nghỉ lớp", x.student.parentPhone, x.student.phone, x.className, toDay(x.date)])] },
    { name: "Lớp học", widths: [28, 22, 10, 12, 12, 12, 12, 16, 16],
      rows: [["Lớp", "Giáo viên", "Sĩ số", "Tháng trước", "Buổi đã dạy", "Buổi theo lịch", "Chuyên cần %", "Phải thu", "Đã thu"],
        ...r.classes.rows.map((x) => [x.name, x.teacher, x.size, x.prevSize, x.held, x.planned, r1(x.rate), x.due, x.paid])] },
  ]);
}
