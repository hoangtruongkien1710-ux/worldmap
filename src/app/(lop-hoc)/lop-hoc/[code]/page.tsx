import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, BookOpen, CalendarDays, MapPin, User, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { fmtDate, todayVN, toDay, WEEKDAY_LONG, WEEKDAY_SHORT, weekday } from "@/lib/dates";
import { money } from "@/lib/money";

export const dynamic = "force-dynamic";

const SOURCE: Record<string, { label: string; cls: string }> = {
  MAKEUP: { label: "Học bù", cls: "bg-violet-50 text-violet-700" },
  MANUAL: { label: "Buổi thêm", cls: "bg-sky-50 text-sky-700" },
};

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const user = await guardPage("class.view");
  const { code } = await params;
  const c = await db.class.findUnique({
    where: { code: decodeURIComponent(code) },
    include: {
      course: { include: { program: true } }, teacher: true, room: true, grade: true,
      schedules: { orderBy: [{ validFrom: "asc" }, { weekday: "asc" }] },
      enrollments: { include: { student: true }, orderBy: { student: { fullName: "asc" } } },
      sessions: { include: { _count: { select: { attendance: true } }, attendance: { select: { status: true } } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] },
    },
  });
  if (!c) notFound();
  if (user.role === "TEACHER" && c.teacherId !== user.id) notFound();
  const today = todayVN();
  const held = c.sessions.filter((s) => s.status === "SCHEDULED" && toDay(s.date) < today);
  const cancelled = c.sessions.filter((s) => s.status === "CANCELLED");
  const upcoming = c.sessions.filter((s) => s.status === "SCHEDULED" && toDay(s.date) >= today);
  let n = 0;

  return (
    <>
      <Link href="/lop-hoc" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> Danh sách lớp</Link>
      <PageHeader title={c.name} subtitle={`${c.code} · ${c.course?.program.name ?? ""} · ${c.status === "OPEN" ? "đang mở" : "đã kết thúc"}`} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Box label="Đã học" value={`${held.length}${c.totalSessions ? `/${c.totalSessions}` : ""} buổi`} />
        <Box label="Sắp tới" value={`${upcoming.length} buổi`} />
        <Box label="Nghỉ" value={`${cancelled.length} buổi`} />
        <Box label="Học viên" value={`${c.enrollments.filter((e) => e.status === "ACTIVE").length}${c.maxStudents ? `/${c.maxStudents}` : ""}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">Thông tin lớp</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2"><User size={16} className="mt-0.5 text-sky-500" />{c.teacher?.fullName ?? "Chưa phân công"}</li>
              <li className="flex gap-2"><MapPin size={16} className="mt-0.5 text-rose-500" />{c.room?.name ?? "—"}</li>
              <li className="flex gap-2"><Users size={16} className="mt-0.5 text-indigo-500" />{c.grade?.name ?? "—"}</li>
              <li className="flex gap-2"><BookOpen size={16} className="mt-0.5 text-amber-500" />{c.course?.coursebook ?? "—"}</li>
              <li className="flex gap-2"><CalendarDays size={16} className="mt-0.5 text-violet-500" />Khai giảng {fmtDate(c.startDate)}{c.endDate ? ` · dự kiến kết thúc ${fmtDate(c.endDate)}` : ""}</li>
            </ul>
            {can(user.role, "tuition.view") && (
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"><b>{money(c.unitPrice)}</b> <span className="text-slate-500">/ {c.feeMode === "PER_SESSION" ? "buổi" : "khóa"}</span></div>
            )}
            <h3 className="mb-2 mt-4 text-sm font-bold text-slate-500">Lịch cố định</h3>
            {c.schedules.map((s) => (
              <div key={s.id} className="flex justify-between py-1 text-sm">
                <span>{WEEKDAY_LONG[s.weekday]}</span><b>{s.startTime}–{s.endTime}</b>
              </div>
            ))}
            <p className="mt-1 text-xs text-slate-400">Áp dụng từ {fmtDate(c.schedules[0]?.validFrom)}. Buổi học tự sinh theo lịch này.</p>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">Học viên</h2>
            <ol className="space-y-1.5 text-sm">
              {c.enrollments.map((e, i) => (
                <li key={e.id} className={clsx("flex items-center gap-2", e.status === "LEFT" && "opacity-60")}>
                  <span className="w-6 text-right text-xs text-slate-400">{i + 1}.</span>
                  <Link href={`/hoc-sinh/${e.student.code}`} className="flex-1 hover:underline">{e.student.fullName}</Link>
                  <span className="text-xs text-slate-400">vào {fmtDate(e.joinDate).slice(0, 5)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="card overflow-hidden lg:col-span-2">
          <h2 className="px-5 pt-5 text-lg font-bold">Danh sách buổi học</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[620px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5">#</th><th className="px-3 py-2.5">Ngày</th><th className="px-3 py-2.5">Giờ</th><th className="px-3 py-2.5">Nội dung</th><th className="px-4 py-2.5 text-right">Điểm danh</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {c.sessions.map((s) => {
                  const day = toDay(s.date);
                  const off = s.status === "CANCELLED";
                  if (!off) n++;
                  const present = s.attendance.filter((a) => a.status === "PRESENT").length;
                  return (
                    <tr key={s.id} className={clsx(off && "bg-slate-50/70 text-slate-400", day === today && "bg-brand-50/60")}>
                      <td className="px-4 py-2 text-xs">{off ? "" : n}</td>
                      <td className="whitespace-nowrap px-3 py-2">{WEEKDAY_SHORT[weekday(day)]} {fmtDate(day)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{s.startTime}–{s.endTime}</td>
                      <td className="px-3 py-2">
                        {SOURCE[s.source] && <span className={`badge mr-1.5 ${SOURCE[s.source].cls}`}>{SOURCE[s.source].label}</span>}
                        {off ? <span><span className="badge mr-1.5 bg-slate-200 text-slate-600">Nghỉ</span>{s.cancelReason}</span> : <span className={day >= today ? "text-slate-400" : ""}>{s.taughtContent ?? (day >= today ? "Chưa học" : "")}</span>}
                        {!off && s.homework && <div className="text-xs text-slate-500">BTVN: {s.homework}</div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        {off || day >= today ? "" : s._count.attendance ? <span className="text-green-700">{present}/{s._count.attendance} có mặt</span> : <span className="text-amber-600">Chưa điểm danh</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return <div className="card p-4"><div className="text-[13px] text-slate-500">{label}</div><div className="text-xl font-extrabold">{value}</div></div>;
}
