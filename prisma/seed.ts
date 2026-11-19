/**
 * Dữ liệu mẫu (mock) để chạy thử. Chạy: npm run db:seed (hoặc npm run db:reset để xóa sạch rồi nạp lại).
 * Khóa học và học phí lấy theo "Bảng giá học phí niêm yết 2026" của WorldMap EDU.
 * Tên học viên, số điện thoại, tài khoản ngân hàng đều là dữ liệu giả.
 */
import { PrismaClient, type AttendanceStatus, type PriceUnit } from "@prisma/client";
import bcrypt from "bcryptjs";
import { syncClassSessions } from "../src/lib/schedule/sync";
import { planSessions } from "../src/lib/schedule/generate";
import { addDays, todayVN, toDate } from "../src/lib/dates";
import { seedAccounting } from "./seed-accounting";
import { seedReportExtras } from "./seed-reports";

const db = new PrismaClient();

// Bộ sinh số ngẫu nhiên cố định để mỗi lần seed ra cùng một dữ liệu.
let seed = 20261118;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const DEMO_PASSWORD = "Worldmap@2026";

// ---------------- Bảng giá niêm yết 2026 ----------------
type CourseSeed = {
  code: string; name: string; level?: string; description?: string; target?: string;
  sessionsMin?: number; sessionsMax?: number; sessionsPerWeek?: string; durationText?: string; sessionHours?: number;
  listedPrice: number; priceUnit?: PriceUnit; classSizeMin?: number; classSizeMax?: number; coursebook?: string;
};
const PROGRAMS: { code: string; name: string; color: string; courses: CourseSeed[] }[] = [
  {
    code: "HSK", name: "Tiếng Trung HSK", color: "#e11d48",
    courses: [
      { code: "HSK 1", name: "HSK 1", level: "HSK 1", description: "Nhập môn tiếng Trung", sessionsMin: 24, sessionsMax: 30, sessionsPerWeek: "2", durationText: "~3 tháng", listedPrice: 3_715_000, classSizeMin: 10, classSizeMax: 15, coursebook: "Giáo trình HSK 1" },
      { code: "HSK 2", name: "HSK 2", level: "HSK 2", description: "Củng cố giao tiếp và từ vựng cơ bản", sessionsMin: 30, sessionsMax: 36, sessionsPerWeek: "2", durationText: "~3 tháng", listedPrice: 4_286_000, classSizeMin: 10, classSizeMax: 15, coursebook: "Giáo trình HSK 2" },
      { code: "HSK 3", name: "HSK 3", level: "HSK 3", description: "Nâng cao ngữ pháp, nghe đọc, phản xạ", sessionsMin: 36, sessionsMax: 40, sessionsPerWeek: "2", durationText: "~4 tháng", listedPrice: 5_000_000, classSizeMin: 8, classSizeMax: 12, coursebook: "Giáo trình HSK 3" },
      { code: "HSK 4", name: "HSK 4", level: "HSK 4", description: "Luyện năng lực trung cấp, định hướng thi chứng chỉ", sessionsMin: 40, sessionsMax: 48, sessionsPerWeek: "2", durationText: "~4–5 tháng", listedPrice: 5_429_000, classSizeMin: 8, classSizeMax: 12, coursebook: "Giáo trình HSK 4" },
    ],
  },
  {
    code: "IELTS", name: "IELTS (THCS–THPT)", color: "#2463eb",
    courses: [
      { code: "IELTS FDN", name: "IELTS Foundation", level: "THCS–THPT", target: "Band 0–3.5", sessionsMin: 20, sessionsMax: 20, sessionsPerWeek: "2–3", durationText: "~3 tháng", listedPrice: 8_600_000, classSizeMin: 8, classSizeMax: 12, coursebook: "Mindset Foundation" },
      { code: "IELTS M1", name: "IELTS Mindset 1", level: "THCS–THPT", target: "Band 3.5–4.5", sessionsMin: 30, sessionsMax: 30, sessionsPerWeek: "2–3", durationText: "~4 tháng", listedPrice: 12_900_000, classSizeMin: 8, classSizeMax: 12, coursebook: "Mindset 1" },
      { code: "IELTS M2", name: "IELTS Mindset 2", level: "THCS–THPT", target: "Band 4.5–5.5", sessionsMin: 30, sessionsMax: 30, sessionsPerWeek: "2–3", durationText: "~4 tháng", listedPrice: 14_400_000, classSizeMin: 6, classSizeMax: 10, coursebook: "Mindset 2" },
      { code: "IELTS M3", name: "IELTS Mindset 3", level: "THCS–THPT", target: "Band 5.5–6.5", sessionsMin: 40, sessionsMax: 40, sessionsPerWeek: "2–3", durationText: "~5 tháng", listedPrice: 21_500_000, classSizeMin: 6, classSizeMax: 10, coursebook: "Mindset 3" },
      { code: "IELTS 1-1", name: "IELTS 1-1", level: "1-1", description: "Luyện đề & kỹ năng", sessionsPerWeek: "linh hoạt", sessionHours: 2, listedPrice: 1_500_000, priceUnit: "SESSION", classSizeMin: 1, classSizeMax: 1, coursebook: "Customized materials" },
    ],
  },
  {
    code: "TOEIC", name: "TOEIC", color: "#059669",
    courses: [
      { code: "TOEIC BASIC", name: "TOEIC Basic", level: "BASIC", target: "Mục tiêu 0–350 điểm", sessionsMin: 25, sessionsMax: 25, listedPrice: 9_000_000, classSizeMin: 10, classSizeMax: 15 },
      { code: "PRE TOEIC", name: "Pre TOEIC", level: "PRE TOEIC", target: "Mục tiêu 350–500 điểm", sessionsMin: 30, sessionsMax: 30, listedPrice: 15_980_000, classSizeMin: 10, classSizeMax: 15 },
      { code: "TOEIC A", name: "TOEIC A", level: "TOEIC A", target: "Mục tiêu 500–650 điểm", sessionsMin: 40, sessionsMax: 40, listedPrice: 17_300_000, classSizeMin: 10, classSizeMax: 15 },
      { code: "TOEIC B", name: "TOEIC B", level: "TOEIC B", target: "Mục tiêu 650–750 điểm", sessionsMin: 50, sessionsMax: 50, listedPrice: 20_000_000, classSizeMin: 10, classSizeMax: 15 },
    ],
  },
];

// ---------------- Lớp học mẫu (khai giảng các tháng 2026) ----------------
type ClassSeed = {
  code: string; name: string; course: string; teacher: string; room: string; color?: string;
  start: string; sessions?: number; size: number; audience: string; schedule: [number, string, string][];
};
// weekday: 0 = CN, 1 = T2 … 6 = T7
const CLASSES: ClassSeed[] = [
  { code: "HSK1-2606", name: "HSK 1 – K2606", course: "HSK 1", teacher: "gv.trung", room: "P.101", start: "2026-06-01", sessions: 26, size: 12, audience: "Sinh viên", schedule: [[1, "18:00", "19:30"], [4, "18:00", "19:30"]] },
  { code: "HSK1-2611", name: "HSK 1 – K2611", course: "HSK 1", teacher: "gv.trung", room: "P.101", start: "2026-11-02", sessions: 26, size: 13, audience: "Người đi làm", schedule: [[1, "18:00", "19:30"], [4, "18:00", "19:30"]] },
  { code: "HSK2-2609", name: "HSK 2 – K2609", course: "HSK 2", teacher: "gv.trung", room: "P.102", start: "2026-09-05", sessions: 32, size: 10, audience: "Sinh viên", schedule: [[6, "08:30", "10:00"], [0, "08:30", "10:00"]] },
  { code: "HSK3-2608", name: "HSK 3 – K2608", course: "HSK 3", teacher: "gv.trung", room: "P.102", start: "2026-08-10", sessions: 38, size: 9, audience: "Người đi làm", schedule: [[1, "19:45", "21:15"], [4, "19:45", "21:15"]] },
  { code: "IFDN-2610", name: "IELTS Foundation – K2610", course: "IELTS FDN", teacher: "gv.ngoc", room: "P.201", start: "2026-10-06", sessions: 20, size: 10, audience: "THCS", schedule: [[2, "17:30", "19:00"], [5, "17:30", "19:00"]] },
  { code: "IM1-2609", name: "IELTS Mindset 1 – K2609", course: "IELTS M1", teacher: "gv.ngoc", room: "P.201", start: "2026-09-07", sessions: 30, size: 9, audience: "THCS", schedule: [[1, "17:30", "19:00"], [3, "17:30", "19:00"]] },
  { code: "IM2-2610", name: "IELTS Mindset 2 – K2610", course: "IELTS M2", teacher: "gv.nam", room: "P.202", start: "2026-10-03", sessions: 30, size: 8, audience: "THPT", schedule: [[6, "14:00", "16:00"], [0, "14:00", "16:00"]] },
  { code: "IM3-2611", name: "IELTS Mindset 3 – K2611", course: "IELTS M3", teacher: "gv.nam", room: "P.202", start: "2026-11-04", sessions: 40, size: 6, audience: "THPT", schedule: [[3, "19:00", "21:00"], [5, "19:00", "21:00"], [0, "09:00", "11:00"]] },
  { code: "I11-NAM", name: "IELTS 1-1 – Vũ Hải Nam", course: "IELTS 1-1", teacher: "gv.nam", room: "P.203", start: "2026-10-15", size: 1, audience: "THPT", schedule: [[4, "20:00", "22:00"]] },
  { code: "TBASIC-2610", name: "TOEIC Basic – K2610", course: "TOEIC BASIC", teacher: "gv.huy", room: "P.301", start: "2026-10-06", sessions: 25, size: 13, audience: "Sinh viên", schedule: [[2, "19:45", "21:15"], [4, "19:45", "21:15"]] },
  { code: "PRET-2609", name: "Pre TOEIC – K2609", course: "PRE TOEIC", teacher: "gv.huy", room: "P.301", start: "2026-09-12", sessions: 30, size: 12, audience: "Sinh viên", schedule: [[6, "19:00", "21:00"], [0, "19:00", "21:00"]] },
  { code: "TOEICA-2611", name: "TOEIC A – K2611", course: "TOEIC A", teacher: "gv.huy", room: "P.302", start: "2026-11-07", sessions: 40, size: 11, audience: "Người đi làm", schedule: [[6, "08:00", "10:00"], [0, "08:00", "10:00"]] },
];

// Mã của bộ dữ liệu mẫu cũ (giai đoạn 0: lớp Toán, Văn...). Seed sẽ dọn chúng đi để thay bằng khóa HSK/IELTS/TOEIC.
const LEGACY_CLASS_CODES = ["TOAN6A", "TOAN7A", "TOAN9", "VAN8", "VAN9", "TA67", "KHTN8"];
const LEGACY_USERS = ["gv.anh", "gv.toan", "gv.van"];

async function cleanupLegacyDemo() {
  const legacy = await db.class.findMany({ where: { code: { in: LEGACY_CLASS_CODES } }, select: { id: true } });
  if (legacy.length === 0) return;
  const ids = legacy.map((c) => c.id);
  await db.$transaction([
    db.attendance.deleteMany({ where: { session: { classId: { in: ids } } } }),
    db.session.deleteMany({ where: { classId: { in: ids } } }),
    db.enrollment.deleteMany({ where: { classId: { in: ids } } }),
    db.classSchedule.deleteMany({ where: { classId: { in: ids } } }),
    db.class.deleteMany({ where: { id: { in: ids } } }),
    // học sinh mẫu cũ (mã HSxxxx) không còn ghi danh lớp nào
    db.student.deleteMany({ where: { code: { startsWith: "HS" }, enrollments: { none: {} } } }),
    db.user.deleteMany({ where: { username: { in: LEGACY_USERS } } }),
    db.subject.deleteMany({ where: { name: { in: ["Toán", "Ngữ văn", "KHTN"] }, classes: { none: {} } } }),
    db.grade.deleteMany({ where: { name: { in: ["Khối 6", "Khối 7", "Khối 8", "Khối 9"] }, classes: { none: {} }, students: { none: {} } } }),
  ]);
  console.log(`Đã xóa ${ids.length} lớp mẫu cũ.`);
}

async function main() {
  const today = todayVN();
  await cleanupLegacyDemo();

  // ---- Cơ sở & cài đặt ----
  const branch = await db.branch.upsert({
    where: { code: "WM01" },
    update: {},
    create: { code: "WM01", name: "WorldMap EDU – Cơ sở 1", phone: "0900 000 000", address: "Số 18 Lê Lợi, TP. Bắc Giang (địa chỉ mẫu)" },
  });

  if (branch.address === "(cập nhật địa chỉ)") await db.branch.update({ where: { id: branch.id }, data: { address: "Số 18 Lê Lợi, TP. Bắc Giang (địa chỉ mẫu)" } });

  const settings: Record<string, unknown> = {
    "center.sidebarTitle": "WORLDMAP EDU",
    "center.name": "WorldMap EDU",
    "center.tagline": "Từng bước chinh phục",
    "center.phone": "0900 000 000",
    "center.address": "Số 18 Lê Lợi, TP. Bắc Giang (địa chỉ mẫu)",
    "center.email": "lienhe@worldmap.example",
    "center.hours": "T2–CN: 8:00–21:30",
    "center.logoUrl": "/logo.png",
    "center.thankYou": "Cảm ơn quý phụ huynh và học viên đã tin tưởng đồng hành cùng WorldMap EDU!",
    "bank.bin": "970436",
    "bank.name": "Vietcombank",
    "bank.accountNo": "0000000000",
    "bank.accountName": "TRUNG TAM WORLDMAP (DU LIEU MAU)",
    "bank.qrEnabled": true,
  };
  for (const [key, value] of Object.entries(settings)) {
    const cur = await db.setting.findUnique({ where: { key } });
    // Chỉ ghi đè các giá trị còn trống hoặc còn là giá trị mẫu cũ, không đè cài đặt người dùng đã sửa.
    const legacy = cur && (cur.value === "" || cur.value === "Chinh phục tri thức" || String(cur.value).startsWith("Cảm ơn quý phụ huynh đã"));
    if (!cur) await db.setting.create({ data: { key, value: value as never } });
    else if (legacy) await db.setting.update({ where: { key }, data: { value: value as never } });
  }

  // ---- Danh mục ----
  for (const name of ["Tiếng Trung", "Tiếng Anh"]) await db.subject.upsert({ where: { name }, update: {}, create: { name } });
  const audiences = ["THCS", "THPT", "Sinh viên", "Người đi làm"];
  for (const [i, name] of audiences.entries()) {
    await db.grade.upsert({ where: { name }, update: {}, create: { name, order: i } });
  }
  for (const name of ["P.101", "P.102", "P.201", "P.202", "P.203", "P.301", "P.302", "Online"]) {
    await db.room.upsert({ where: { branchId_name: { branchId: branch.id, name } }, update: {}, create: { name, branchId: branch.id } });
  }

  // ---- Chương trình & khóa học ----
  const courseIds: Record<string, string> = {};
  const courseInfo: Record<string, CourseSeed & { color: string; program: string }> = {};
  for (const [pi, p] of PROGRAMS.entries()) {
    const program = await db.program.upsert({
      where: { code: p.code },
      update: { name: p.name, color: p.color, order: pi },
      create: { code: p.code, name: p.name, color: p.color, order: pi },
    });
    for (const [ci, c] of p.courses.entries()) {
      const data = { ...c, programId: program.id, order: ci, priceUnit: c.priceUnit ?? "COURSE" };
      const row = await db.course.upsert({ where: { code: c.code }, update: data, create: data });
      courseIds[c.code] = row.id;
      courseInfo[c.code] = { ...c, color: p.color, program: p.code };
    }
  }

  // ---- Người dùng ----
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [
    { username: "admin", fullName: "Quản trị viên", role: "ADMIN" as const },
    { username: "quanly", fullName: "Phạm Thị Hoa", role: "MANAGER" as const },
    { username: "ketoan", fullName: "Đỗ Thu Trang", role: "ACCOUNTANT" as const },
    { username: "gv.trung", fullName: "Lý Minh Châu", role: "TEACHER" as const },
    { username: "gv.ngoc", fullName: "Trần Bảo Ngọc", role: "TEACHER" as const },
    { username: "gv.nam", fullName: "Nguyễn Hoàng Nam", role: "TEACHER" as const },
    { username: "gv.huy", fullName: "Lê Quang Huy", role: "TEACHER" as const },
  ];
  const userIds: Record<string, string> = {};
  for (const [i, u] of users.entries()) {
    const phone = `09${String(12_345_670 + i * 1_111_111).slice(0, 8)}`; // số giả
    const prev = await db.user.findUnique({ where: { username: u.username } });
    const row = await db.user.upsert({
      where: { username: u.username },
      update: { fullName: u.fullName, role: u.role, ...(!prev?.phone || prev.phone === "09xxxxxxxx" ? { phone } : {}) },
      create: { ...u, passwordHash: hash, branchId: branch.id, phone },
    });
    userIds[u.username] = row.id;
  }

  const subjectOf = async (program: string) =>
    (await db.subject.findUniqueOrThrow({ where: { name: program === "HSK" ? "Tiếng Trung" : "Tiếng Anh" } })).id;
  const gradeOf = async (n: string) => (await db.grade.findUniqueOrThrow({ where: { name: n } })).id;
  const roomOf = async (n: string) =>
    (await db.room.findUniqueOrThrow({ where: { branchId_name: { branchId: branch.id, name: n } } })).id;

  // ---- Lớp học ----
  const classIds: Record<string, string> = {};
  for (const c of CLASSES) {
    const course = courseInfo[c.course];
    const rules = c.schedule.map(([weekday, startTime, endTime]) => ({ weekday, startTime, endTime, validFrom: c.start }));
    // Ngày kết thúc = ngày của buổi thứ N theo lịch (lớp 1-1 không có ngày kết thúc)
    let endDate: string | null = null;
    if (c.sessions) {
      const planned = planSessions(rules, { from: c.start, to: addDays(c.start, 400) }, c.start);
      endDate = planned[c.sessions - 1].date;
    }
    const isSession = course.priceUnit === "SESSION";
    const data = {
      name: c.name,
      branchId: branch.id,
      courseId: courseIds[c.course],
      subjectId: await subjectOf(course.program),
      gradeId: await gradeOf(c.audience),
      roomId: await roomOf(c.room),
      teacherId: userIds[c.teacher],
      color: course.color,
      startDate: toDate(c.start),
      endDate: endDate ? toDate(endDate) : null,
      status: endDate && endDate < today ? ("ENDED" as const) : ("OPEN" as const),
      feeMode: isSession ? ("PER_SESSION" as const) : ("COURSE" as const),
      unitPrice: course.listedPrice,
      totalSessions: c.sessions ?? null,
      maxStudents: course.classSizeMax ?? null,
    };
    const existing = await db.class.findUnique({ where: { code: c.code } });
    const row = existing
      ? await db.class.update({ where: { id: existing.id }, data })
      : await db.class.create({
          data: { ...data, code: c.code, schedules: { create: rules.map((r) => ({ ...r, validFrom: toDate(r.validFrom) })) } },
        });
    classIds[c.code] = row.id;
    const syncTo = endDate ?? addDays(today, 60);
    await syncClassSessions(db, row.id, { from: c.start, to: syncTo });
  }

  // ---- Lịch học: nghỉ lễ, giáo viên ốm, học bù, buổi thi thử ----
  const cancel = async (where: object, reason: string) => {
    const w = { ...where, status: "SCHEDULED" as const, source: "SCHEDULE" as const, cancelReason: null };
    await db.attendance.deleteMany({ where: { session: w } }); // buổi nghỉ thì không có điểm danh
    await db.session.updateMany({ where: w, data: { status: "CANCELLED", cancelReason: reason } });
  };
  await cancel({ date: { in: [toDate("2026-09-01"), toDate("2026-09-02")] } }, "Lễ Quốc khánh 2/9");
  await cancel({ classId: classIds["HSK2-2609"], date: toDate("2026-10-10") }, "Sinh viên thi giữa kỳ – đã xếp học bù");
  await cancel({ date: toDate("2026-11-20"), startTime: { gte: "17:00" } }, "Ngày Nhà giáo Việt Nam 20/11");
  await cancel({ classId: classIds["HSK1-2611"], date: toDate("2026-11-12") }, "Giáo viên ốm – sẽ học bù");
  await cancel({ classId: classIds["IM1-2609"], date: toDate("2026-10-14") }, "Phòng P.201 sửa điều hòa – đã xếp học bù");
  const extra = [
    { cls: "HSK1-2611", date: "2026-11-14", startTime: "18:00", endTime: "19:30", source: "MAKEUP" as const, taughtContent: "Học bù buổi 12/11" },
    { cls: "IM1-2609", date: "2026-10-17", startTime: "09:00", endTime: "10:30", source: "MAKEUP" as const, taughtContent: "Học bù buổi 14/10" },
    { cls: "HSK2-2609", date: "2026-10-13", startTime: "18:00", endTime: "19:30", source: "MAKEUP" as const, taughtContent: "Học bù buổi 10/10" },
    { cls: "PRET-2609", date: "2026-11-21", startTime: "14:00", endTime: "16:00", source: "MANUAL" as const, taughtContent: "Thi thử TOEIC giữa khóa (Listening + Reading)" },
    { cls: "IM2-2610", date: "2026-11-25", startTime: "18:00", endTime: "20:00", source: "MANUAL" as const, taughtContent: "Mock test IELTS: Writing Task 1, 2" },
  ];
  for (const e of extra) {
    await db.session.upsert({
      where: { classId_date_startTime: { classId: classIds[e.cls], date: toDate(e.date), startTime: e.startTime } },
      update: {},
      create: { classId: classIds[e.cls], date: toDate(e.date), startTime: e.startTime, endTime: e.endTime, source: e.source, taughtContent: e.taughtContent },
    });
  }

  // ---- Học viên ----
  if ((await db.student.count({ where: { code: { startsWith: "HV" } } })) === 0) {
    const ho = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đỗ", "Bùi", "Ngô", "Dương", "Phan", "Đặng", "Đinh", "Mai"];
    const dem = ["Minh", "Thu", "Quỳnh", "Phương", "Hải", "Đức", "Thanh", "Bảo", "Gia", "Ngọc", "Tuấn", "Khánh", "Hà", "Thảo", "Anh"];
    const ten = ["Anh", "Chi", "Đăng", "Bảo", "Nam", "Linh", "Long", "Hân", "Kiệt", "My", "Khang", "Vy", "Huy", "Hiếu", "Đạt", "Trang", "Uyên", "Phúc"];
    const schools: Record<string, string[]> = {
      THCS: ["THCS Trưng Vương", "THCS Cầu Giấy", "THCS Lê Quý Đôn", "THCS Nghĩa Tân"],
      THPT: ["THPT Chu Văn An", "THPT Kim Liên", "THPT Yên Hòa", "THPT Phan Đình Phùng"],
      "Sinh viên": ["ĐH Ngoại thương", "ĐH Bách khoa Hà Nội", "ĐH Kinh tế Quốc dân", "Học viện Ngân hàng"],
      "Người đi làm": ["Công ty TNHH ABC", "Ngân hàng (nhân viên)", "Kế toán tự do", "Công ty xuất nhập khẩu"],
    };
    const parentNames = ["Anh Hùng", "Chị Mai", "Chị Lan", "Anh Dũng", "Chị Hà", "Chị Hương", "Anh Tuấn", "Anh Sơn"];
    let n = 0;
    const newStudent = async (audience: string, fullName?: string) => {
      n++;
      const minor = audience === "THCS" || audience === "THPT";
      const parent = minor ? pick(parentNames) : null;
      return db.student.create({
        data: {
          code: `HV${String(n).padStart(4, "0")}`,
          fullName: fullName ?? `${pick(ho)} ${pick(dem)} ${pick(ten)}`,
          branchId: branch.id,
          gradeId: await gradeOf(audience),
          school: pick(schools[audience]),
          parentName: parent,
          parentRelation: parent ? (parent.startsWith("Chị") ? "mẹ" : "bố") : null,
          phone: !minor || rand() < (audience === "THPT" ? 0.8 : 0.4) ? `0${pick(["9", "8", "3", "7"])}${String(Math.floor(10_000_000 + rand() * 89_999_999))}` : null,
          parentPhone: minor ? `09${String(Math.floor(10_000_000 + rand() * 89_999_999))}` : null,
        },
      });
    };
    const created: { id: string; audience: string }[] = [];
    for (const c of CLASSES) {
      const classRow = await db.class.findUniqueOrThrow({ where: { id: classIds[c.code] } });
      for (let i = 0; i < c.size; i++) {
        // 10% học viên học thêm lớp thứ hai: tái sử dụng học viên cùng đối tượng đã có
        const reuse = created.filter((s) => s.audience === c.audience);
        const student = reuse.length > 3 && rand() < 0.1
          ? reuse[Math.floor(rand() * reuse.length)]
          : await newStudent(c.audience, c.code === "I11-NAM" ? "Vũ Hải Nam" : undefined).then((s) => {
              const v = { id: s.id, audience: c.audience };
              created.push(v);
              return v;
            });
        const already = await db.enrollment.findFirst({ where: { studentId: student.id, classId: classRow.id } });
        if (already) continue;
        const late = rand() < 0.1 ? 14 : 0; // vài em vào muộn 2 tuần
        const r = rand();
        await db.enrollment.create({
          data: {
            studentId: student.id,
            classId: classRow.id,
            joinDate: toDate(addDays(c.start, late)),
            status: classRow.status === "ENDED" ? "LEFT" : "ACTIVE",
            leaveDate: classRow.status === "ENDED" ? classRow.endDate : null,
            percentDiscount: r < 0.15 ? 10 : r < 0.25 ? 5 : 0, // ưu đãi theo từng thời điểm
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
        const status: AttendanceStatus = r < 0.87 ? "PRESENT" : r < 0.94 ? "EXCUSED" : "ABSENT";
        return { sessionId: s.id, studentId: e.studentId, status, updatedById: s.class.teacherId };
      });
    if (rows.length) await db.attendance.createMany({ data: rows, skipDuplicates: true });
  }

  // ---- Nội dung đã dạy, bài tập về nhà cho các buổi đã học ----
  const LESSON: Record<string, (n: number) => [string, string]> = {
    HSK: (n) => [`Bài ${n}: từ vựng, ngữ pháp và luyện nói theo giáo trình`, `Viết chữ Hán bài ${n}, nghe lại audio 2 lần`],
    IELTS: (n) => [`Unit ${Math.ceil(n / 2)} – ${n % 2 ? "Reading & Vocabulary" : "Listening & Speaking"}`, n % 2 ? "Workbook Reading + 20 từ mới" : "Ghi âm Speaking Part 2 (2 phút)"],
    TOEIC: (n) => [`Buổi ${n}: ${["Part 1–2 Photographs & Q-R", "Part 3–4 Conversations", "Part 5–6 Grammar", "Part 7 Reading"][n % 4]}`, "Làm 50 câu bài tập trên app"],
  };
  for (const id of Object.values(classIds)) {
    const cls = await db.class.findUniqueOrThrow({ where: { id }, include: { course: { include: { program: true } } } });
    const lesson = LESSON[cls.course?.program.code ?? "IELTS"];
    const past = await db.session.findMany({ where: { classId: id, status: "SCHEDULED", source: "SCHEDULE", date: { lt: toDate(today) } }, orderBy: { date: "asc" } });
    for (const [i, s] of past.entries()) {
      if (s.taughtContent) continue;
      const [taughtContent, homework] = lesson(i + 1);
      await db.session.update({ where: { id: s.id }, data: { taughtContent, homework } });
    }
  }

  // ---- Số điện thoại riêng của học viên (bổ sung cho dữ liệu cũ, chạy một lần) ----
  if (!(await db.setting.findUnique({ where: { key: "seed.studentPhones" } }))) {
    const list = await db.student.findMany({ where: { phone: null }, include: { grade: true }, orderBy: { code: "asc" } });
    for (const st of list) {
      const minor = !!st.parentName;
      const own = !minor || rand() < (st.grade?.name === "THPT" ? 0.8 : 0.4);
      if (!own) continue;
      // Người lớn trước đây ghi số của mình vào ô phụ huynh: chuyển sang ô học viên.
      const phone = !minor && st.parentPhone ? st.parentPhone : `0${pick(["9", "8", "3", "7"])}${String(Math.floor(10_000_000 + rand() * 89_999_999))}`;
      await db.student.update({ where: { id: st.id }, data: { phone, ...(!minor ? { parentPhone: null } : {}) } });
    }
    await db.setting.create({ data: { key: "seed.studentPhones", value: true } });
  }

  // ---- Kế toán: quỹ, ngân hàng, học phí, chi phí, lương, bút toán ----
  await seedAccounting(db, rand, today);
  await seedReportExtras(db, rand, today);

  const counts = {
    programs: await db.program.count(),
    courses: await db.course.count(),
    users: await db.user.count(),
    classes: await db.class.count(),
    students: await db.student.count(),
    enrollments: await db.enrollment.count(),
    sessions: await db.session.count(),
    attendance: await db.attendance.count(),
  };
  console.log("Đã nạp dữ liệu mẫu:", counts);
  console.log(`Tài khoản mẫu: ${users.map((u) => u.username).join(", ")} – mật khẩu: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
