/**
 * Dữ liệu mẫu (mock) để chạy thử. Chạy: npm run db:seed (hoặc npm run db:reset để xóa sạch rồi nạp lại).
 * Tất cả tên, số điện thoại, tài khoản ngân hàng đều là dữ liệu giả.
 */
import { PrismaClient, type AttendanceStatus, type FeeMode, type ExcusedPolicy } from "@prisma/client";
import bcrypt from "bcryptjs";
import { syncClassSessions } from "../src/lib/schedule/sync";
import { addDays, todayVN, toDate } from "../src/lib/dates";

const db = new PrismaClient();

// Bộ sinh số ngẫu nhiên cố định để mỗi lần seed ra cùng một dữ liệu.
let seed = 20261118;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const DEMO_PASSWORD = "Worldmap@2026";

async function main() {
  const today = todayVN();

  // ---- Cơ sở & cài đặt ----
  const branch = await db.branch.upsert({
    where: { code: "WM01" },
    update: {},
    create: { code: "WM01", name: "WorldMap EDU – Cơ sở 1", phone: "0900 000 000", address: "(cập nhật địa chỉ)" },
  });

  const settings: Record<string, unknown> = {
    "center.sidebarTitle": "WORLDMAP EDU",
    "center.name": "WorldMap EDU",
    "center.tagline": "Chinh phục tri thức",
    "center.phone": "0900 000 000",
    "center.address": "",
    "center.logoUrl": "",
    "center.thankYou": "Cảm ơn quý phụ huynh đã tin tưởng đồng hành cùng trung tâm!",
    "bank.bin": "970436",
    "bank.name": "Vietcombank",
    "bank.accountNo": "0000000000",
    "bank.accountName": "TRUNG TAM WORLDMAP (DU LIEU MAU)",
    "bank.qrEnabled": true,
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value: value as never } });
  }

  // ---- Danh mục ----
  const subjects = ["Toán", "Ngữ văn", "Tiếng Anh", "KHTN"];
  for (const name of subjects) await db.subject.upsert({ where: { name }, update: {}, create: { name } });
  for (const [i, name] of ["Khối 6", "Khối 7", "Khối 8", "Khối 9"].entries()) {
    await db.grade.upsert({ where: { name }, update: {}, create: { name, order: i + 6 } });
  }
  for (const name of ["P.101", "P.102", "P.201", "Online"]) {
    await db.room.upsert({
      where: { branchId_name: { branchId: branch.id, name } },
      update: {},
      create: { name, branchId: branch.id },
    });
  }
  const subjectId = async (n: string) => (await db.subject.findUniqueOrThrow({ where: { name: n } })).id;
  const gradeId = async (n: string) => (await db.grade.findUniqueOrThrow({ where: { name: n } })).id;
  const roomId = async (n: string) =>
    (await db.room.findUniqueOrThrow({ where: { branchId_name: { branchId: branch.id, name: n } } })).id;

  // ---- Người dùng ----
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [
    { username: "admin", fullName: "Quản trị viên", role: "ADMIN" as const },
    { username: "quanly", fullName: "Phạm Thị Hoa", role: "MANAGER" as const },
    { username: "ketoan", fullName: "Đỗ Thu Trang", role: "ACCOUNTANT" as const },
    { username: "gv.anh", fullName: "Lê Minh Anh", role: "TEACHER" as const },
    { username: "gv.toan", fullName: "Nguyễn Văn Khoa", role: "TEACHER" as const },
    { username: "gv.van", fullName: "Trần Thu Hằng", role: "TEACHER" as const },
  ];
  const userIds: Record<string, string> = {};
  for (const u of users) {
    const row = await db.user.upsert({
      where: { username: u.username },
      update: {},
      create: { ...u, passwordHash: hash, branchId: branch.id, phone: "09xxxxxxxx" },
    });
    userIds[u.username] = row.id;
  }

  // ---- Lớp học (theo ví dụ trong video) ----
  type ClassSeed = {
    code: string; name: string; subject: string; grade: string; room: string; teacher: string; color: string;
    feeMode: FeeMode; unitPrice: number; packageSize?: number; excusedPolicy?: ExcusedPolicy;
    schedule: [number, string, string][];
  };
  const classes: ClassSeed[] = [
    { code: "TOAN6A", name: "Toán 6A", subject: "Toán", grade: "Khối 6", room: "P.101", teacher: "gv.toan", color: "#2463eb",
      feeMode: "PER_SCHEDULED", unitPrice: 120_000, schedule: [[1, "18:00", "19:30"], [4, "18:00", "19:30"]] },
    { code: "TOAN7A", name: "Toán 7A", subject: "Toán", grade: "Khối 7", room: "P.101", teacher: "gv.toan", color: "#7c3aed",
      feeMode: "MONTHLY_FIXED", unitPrice: 900_000, excusedPolicy: "NONE", schedule: [[2, "18:00", "19:30"], [5, "18:00", "19:30"]] },
    { code: "TOAN9", name: "Toán 9 – Ôn thi vào 10", subject: "Toán", grade: "Khối 9", room: "P.201", teacher: "gv.toan", color: "#e11d48",
      feeMode: "PACKAGE", unitPrice: 1_600_000, packageSize: 8,
      schedule: [[3, "19:00", "21:00"], [6, "19:00", "21:00"], [0, "08:00", "10:00"]] },
    { code: "VAN8", name: "Ngữ văn 8", subject: "Ngữ văn", grade: "Khối 8", room: "P.102", teacher: "gv.van", color: "#ea580c",
      feeMode: "PER_SCHEDULED", unitPrice: 100_000, excusedPolicy: "DEDUCT", schedule: [[2, "17:30", "19:00"], [6, "15:00", "16:30"]] },
    { code: "VAN9", name: "Ngữ văn 9", subject: "Ngữ văn", grade: "Khối 9", room: "P.102", teacher: "gv.van", color: "#d97706",
      feeMode: "MONTHLY_FIXED", unitPrice: 800_000, excusedPolicy: "CARRY_OVER", schedule: [[4, "19:00", "20:30"], [0, "14:00", "15:30"]] },
    { code: "TA67", name: "Tiếng Anh giao tiếp 6-7", subject: "Tiếng Anh", grade: "Khối 6", room: "P.201", teacher: "gv.anh", color: "#059669",
      feeMode: "PER_ATTENDED", unitPrice: 110_000, schedule: [[1, "19:45", "21:00"], [3, "17:30", "18:45"]] },
    { code: "KHTN8", name: "KHTN 8", subject: "KHTN", grade: "Khối 8", room: "Online", teacher: "gv.toan", color: "#0891b2",
      feeMode: "PER_SCHEDULED", unitPrice: 100_000, schedule: [[5, "19:45", "21:15"]] },
  ];

  const classIds: Record<string, string> = {};
  for (const c of classes) {
    const row = await db.class.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code, name: c.name, branchId: branch.id,
        subjectId: await subjectId(c.subject), gradeId: await gradeId(c.grade), roomId: await roomId(c.room),
        teacherId: userIds[c.teacher], color: c.color, startDate: toDate("2026-08-01"),
        feeMode: c.feeMode, unitPrice: c.unitPrice, packageSize: c.packageSize ?? null,
        excusedPolicy: c.excusedPolicy ?? "NONE",
        schedules: {
          create: c.schedule.map(([weekday, startTime, endTime]) => ({
            weekday, startTime, endTime, validFrom: toDate("2026-08-01"),
          })),
        },
      },
    });
    classIds[c.code] = row.id;
    await syncClassSessions(db, row.id, { from: "2026-08-01", to: "2026-12-31" });
  }

  // Lớp Toán 6A nghỉ ngày 02/11 (giáo viên ốm)
  await db.session.updateMany({
    where: { classId: classIds.TOAN6A, date: toDate("2026-11-02") },
    data: { status: "CANCELLED", cancelReason: "Giáo viên ốm" },
  });

  // ---- Học sinh ----
  if ((await db.student.count()) === 0) {
    const ho = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đỗ", "Bùi", "Ngô", "Dương", "Phan", "Đặng"];
    const dem = ["Minh", "Thu", "Quỳnh", "Phương", "Hải", "Đức", "Thanh", "Bảo", "Gia", "Ngọc", "Tuấn", "Khánh", "Hà"];
    const ten = ["Anh", "Chi", "Đăng", "Bảo", "Nam", "Linh", "Long", "Hân", "Kiệt", "My", "Khang", "Vy", "Huy", "Hiếu", "Đạt"];
    const schools = ["THCS Trưng Vương", "THCS Cầu Giấy", "THCS Lê Quý Đôn", "THCS Nghĩa Tân", "THCS Dịch Vọng"];
    const parents = ["Anh Hùng", "Chị Mai", "Chị Lan", "Anh Dũng", "Chị Hà", "Anh Hương", "Chị Tuấn", "Chị Sơn", "Anh Lan"];
    const byGrade: Record<string, string[]> = {
      "Khối 6": ["TOAN6A", "TA67"],
      "Khối 7": ["TOAN7A", "TA67"],
      "Khối 8": ["VAN8", "KHTN8"],
      "Khối 9": ["TOAN9", "VAN9"],
    };
    const grades = ["Khối 6", "Khối 7", "Khối 8", "Khối 9"];
    for (let i = 1; i <= 45; i++) {
      const grade = grades[(i - 1) % 4];
      const student = await db.student.create({
        data: {
          code: `HS${String(i).padStart(4, "0")}`,
          fullName: `${pick(ho)} ${pick(dem)} ${pick(ten)}`,
          branchId: branch.id,
          gradeId: await gradeId(grade),
          school: pick(schools),
          parentName: pick(parents),
          parentRelation: rand() < 0.6 ? "mẹ" : "bố",
          parentPhone: `09${String(10_000_000 + Math.floor(rand() * 89_999_999)).slice(0, 8)}`,
        },
      });
      // 70% học 2 lớp, còn lại 1 lớp
      const options = byGrade[grade];
      const chosen = rand() < 0.7 ? options : [pick(options)];
      for (const code of chosen) {
        const lateJoin = rand() < 0.12;
        await db.enrollment.create({
          data: {
            studentId: student.id,
            classId: classIds[code],
            joinDate: toDate(lateJoin ? "2026-10-12" : "2026-08-01"),
            monthlyDiscount: rand() < 0.08 ? 50_000 : 0,
          },
        });
      }
    }
  }

  // ---- Điểm danh mẫu cho các buổi đã qua (để trống 2 ngày gần nhất để có "buổi chưa điểm danh") ----
  const cutoff = addDays(today, -2);
  const pastSessions = await db.session.findMany({
    where: { date: { lte: toDate(cutoff) }, status: "SCHEDULED", attendance: { none: {} } },
    include: { class: { include: { enrollments: true } } },
  });
  for (const s of pastSessions) {
    const rows = s.class.enrollments
      .filter((e) => e.joinDate <= s.date && (!e.leaveDate || e.leaveDate >= s.date))
      .map((e) => {
        const r = rand();
        const status: AttendanceStatus = r < 0.88 ? "PRESENT" : r < 0.94 ? "EXCUSED" : "ABSENT";
        return { sessionId: s.id, studentId: e.studentId, status, updatedById: s.class.teacherId };
      });
    if (rows.length) await db.attendance.createMany({ data: rows, skipDuplicates: true });
  }

  const counts = {
    users: await db.user.count(),
    classes: await db.class.count(),
    students: await db.student.count(),
    enrollments: await db.enrollment.count(),
    sessions: await db.session.count(),
    attendance: await db.attendance.count(),
  };
  console.log("Đã nạp dữ liệu mẫu:", counts);
  console.log(`Tài khoản mẫu: admin, quanly, ketoan, gv.anh, gv.toan, gv.van – mật khẩu: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
