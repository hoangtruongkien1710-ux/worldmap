import Link from "next/link";
import { CalendarClock, CheckCircle2, CircleAlert, MapPin, Presentation, User, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { addDays, fmtDate, toDate, todayVN, WEEKDAY_LONG, weekday } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  const user = await requireUser();
  const { loi } = await searchParams;
  const today = todayVN();
  // Giáo viên chỉ thấy lớp mình dạy (lọc ở server).
  const classFilter = user.role === "TEACHER" ? { teacherId: user.id } : {};

  const [todaySessions, upcoming, overdue, activeStudents, openClasses] = await Promise.all([
    db.session.findMany({
      where: { date: toDate(today), class: classFilter },
      include: { class: { include: { teacher: true, room: true, _count: { select: { enrollments: true } } } }, _count: { select: { attendance: true } } },
      orderBy: { startTime: "asc" },
    }),
    db.session.findMany({
      where: { date: { gt: toDate(today), lte: toDate(addDays(today, 3)) }, status: "SCHEDULED", class: classFilter },
      include: { class: { include: { teacher: true, room: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    db.session.findMany({
      where: {
        date: { lt: toDate(today), gte: toDate(addDays(today, -14)) },
        status: "SCHEDULED",
        attendance: { none: {} },
        class: classFilter,
      },
      include: { class: true },
      orderBy: { date: "desc" },
    }),
    db.student.count({
      where: user.role === "TEACHER"
        ? { status: "ACTIVE", enrollments: { some: { status: "ACTIVE", class: { teacherId: user.id } } } }
        : { status: "ACTIVE" },
    }),
    db.class.count({ where: { status: "OPEN", ...classFilter } }),
  ]);

  const held = todaySessions.filter((s) => s.status === "SCHEDULED");
  const marked = held.filter((s) => s._count.attendance > 0).length;

  return (
    <>
      {loi === "khong-co-quyen" && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tài khoản của bạn không có quyền vào khu vực Kế toán.
        </div>
      )}
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        subtitle={`${WEEKDAY_LONG[weekday(today)]}, ${fmtDate(today)} · Hôm nay có ${held.length} buổi học, đã điểm danh ${marked}/${held.length}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<CalendarClock size={18} />} label="Buổi học hôm nay" value={held.length} />
        <Stat icon={<CheckCircle2 size={18} />} label="Đã điểm danh hôm nay" value={`${marked}/${held.length}`} />
        <Stat icon={<Presentation size={18} />} label="Lớp đang mở" value={openClasses} />
        <Stat icon={<Users size={18} />} label="Học sinh đang học" value={activeStudents} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">Lịch dạy hôm nay</h2>
          {todaySessions.length === 0 && <p className="text-sm text-slate-500">Hôm nay không có buổi học nào.</p>}
          <div className="space-y-3">
            {todaySessions.map((s) => (
              <div key={s.id} className="flex gap-4 rounded-xl border border-slate-100 p-3" style={{ borderLeft: `4px solid ${s.class.color}` }}>
                <div className="w-14 shrink-0 text-center">
                  <div className="font-bold">{s.startTime}</div>
                  <div className="text-xs text-slate-500">{s.endTime}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={s.status === "CANCELLED" ? "font-semibold text-slate-400 line-through" : "font-semibold"}>{s.class.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><MapPin size={12} />{s.class.room?.name ?? "—"}</span>
                    <span className="inline-flex items-center gap-1"><User size={12} />{s.class.teacher?.fullName ?? "—"}</span>
                    <span className="inline-flex items-center gap-1"><Users size={12} />{s.class._count.enrollments} học sinh</span>
                  </div>
                </div>
                <div className="self-center">
                  {s.status === "CANCELLED" ? (
                    <span className="badge bg-slate-100 text-slate-500">Nghỉ</span>
                  ) : s._count.attendance > 0 ? (
                    <span className="badge bg-green-50 text-green-700">Đã điểm danh</span>
                  ) : (
                    <span className="badge bg-amber-50 text-amber-700">Chưa điểm danh</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <h2 className="mb-3 mt-8 text-lg font-bold">Sắp tới</h2>
          <div className="divide-y divide-slate-100">
            {upcoming.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-2.5 text-sm sm:gap-3">
                <span className="w-12 shrink-0 text-slate-500 sm:w-24">{fmtDate(s.date).slice(0, 5)}<span className="hidden sm:inline">{fmtDate(s.date).slice(5)}</span></span>
                <span className="w-[5.5rem] shrink-0 font-semibold sm:w-24">{s.startTime}–{s.endTime}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.class.color }} />
                <span className="min-w-0 flex-1 truncate">{s.class.name}</span>
                <span className="hidden text-slate-500 sm:inline">{s.class.room?.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><CircleAlert size={18} className="text-amber-500" /> Cần chú ý</h2>
          {overdue.length === 0 ? (
            <p className="text-sm text-slate-500">Không có buổi nào quá hạn điểm danh.</p>
          ) : (
            <ul className="space-y-2.5">
              {overdue.map((s) => (
                <li key={s.id} className="rounded-xl bg-amber-50/60 px-3 py-2.5 text-sm">
                  <b>Chưa điểm danh: {s.class.name}</b>
                  <div className="text-xs text-slate-500">{WEEKDAY_LONG[weekday(s.date.toISOString().slice(0, 10))]} {fmtDate(s.date)} · {s.startTime}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-xs text-slate-400">
            Công nợ học phí và hoạt động gần đây sẽ hiện ở đây từ giai đoạn 4. <Link href="/huong-dan" className="underline">Xem lộ trình</Link>
          </p>
        </section>
      </div>
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500"><span className="text-brand-500">{icon}</span>{label}</div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
    </div>
  );
}
