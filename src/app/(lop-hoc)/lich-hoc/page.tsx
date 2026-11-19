import Link from "next/link";
import clsx from "clsx";
import { CalendarPlus, ChevronLeft, ChevronRight, ClipboardCheck, MapPin, RotateCcw, Trash2, User, XCircle } from "lucide-react";
import { ConfirmButton, ModalButton, RowMenu } from "@/components/ui/modal";
import { AddSessionForm, CancelSessionForm } from "@/components/classes/session-forms";
import { deleteSession, restoreSession } from "@/lib/actions/sessions";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { addDays, fmtDate, mondayOf, todayVN, toDate, toDay, WEEKDAY_LONG, weekday } from "@/lib/dates";

export const metadata = { title: "Lịch học" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ tuan?: string; gv?: string }> }) {
  const user = await guardPage("class.view");
  const sp = await searchParams;
  const today = todayVN();
  const monday = mondayOf(sp.tuan && /^\d{4}-\d{2}-\d{2}$/.test(sp.tuan) ? sp.tuan : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const isTeacher = user.role === "TEACHER";
  const teachers = isTeacher ? [] : await db.user.findMany({ where: { role: "TEACHER", active: true }, orderBy: { fullName: "asc" } });
  const teacherId = isTeacher ? user.id : teachers.find((t) => t.username === sp.gv)?.id;
  const manage = can(user.role, "class.manage");
  const openClasses = manage ? await db.class.findMany({ where: { status: "OPEN" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }) : [];

  const sessions = await db.session.findMany({
    where: { date: { gte: toDate(days[0]), lte: toDate(days[6]) }, ...(teacherId ? { class: { teacherId } } : {}) },
    include: { class: { include: { teacher: true, room: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } }, _count: { select: { attendance: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  const link = (o: { tuan?: string; gv?: string | null }) => {
    const u = new URLSearchParams();
    const t = o.tuan ?? monday;
    const g = o.gv === null ? undefined : o.gv ?? sp.gv;
    if (t !== mondayOf(today)) u.set("tuan", t);
    if (g) u.set("gv", g);
    const s = u.toString();
    return `/lich-hoc${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Lịch học"
        subtitle={`Tuần ${fmtDate(days[0])} – ${fmtDate(days[6])} · ${sessions.filter((s) => s.status === "SCHEDULED").length} buổi`}
        actions={<>
          {manage && (
            <ModalButton variant="primary" label="Thêm buổi học" icon={<CalendarPlus size={16} />} title="Thêm buổi học bù / buổi thêm" size="sm">
              <AddSessionForm classes={openClasses} />
            </ModalButton>
          )}
          <div className="inline-flex items-center rounded-xl bg-white ring-1 ring-slate-200">
            <Link href={link({ tuan: addDays(monday, -7) })} className="rounded-l-xl p-2 text-slate-500 hover:bg-slate-50" aria-label="Tuần trước"><ChevronLeft size={18} /></Link>
            <Link href={link({ tuan: mondayOf(today) })} className="px-3 text-sm font-semibold">Tuần này</Link>
            <Link href={link({ tuan: addDays(monday, 7) })} className="rounded-r-xl p-2 text-slate-500 hover:bg-slate-50" aria-label="Tuần sau"><ChevronRight size={18} /></Link>
          </div>
        </>}
      />
      {!isTeacher && (
        <div className="mb-5 flex flex-wrap gap-2 text-sm">
          <Chip href={link({ gv: null })} active={!teacherId}>Tất cả giáo viên</Chip>
          {teachers.map((t) => <Chip key={t.id} href={link({ gv: t.username })} active={teacherId === t.id}>{t.fullName}</Chip>)}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const list = sessions.filter((s) => toDay(s.date) === d);
          const isToday = d === today;
          return (
            <div key={d} className={clsx("card flex min-h-40 flex-col p-2.5", isToday && "ring-2 ring-brand-500")}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <span className={clsx("text-sm font-bold", isToday && "text-brand-600")}>{WEEKDAY_LONG[weekday(d)]}</span>
                <span className="text-xs text-slate-500">{fmtDate(d).slice(0, 5)}</span>
              </div>
              <div className="space-y-2">
                {list.length === 0 && <div className="px-1 text-xs text-slate-400">Không có lớp</div>}
                {list.map((s) => {
                  const cancelled = s.status === "CANCELLED";
                  const marked = s._count.attendance > 0;
                  return (
                    <div key={s.id} className={clsx("rounded-lg p-2 text-xs", cancelled && "opacity-60")} style={{ background: `${s.class.color}14`, borderLeft: `3px solid ${s.class.color}` }}>
                      <div className="flex items-center justify-between gap-1 font-bold text-slate-800">{s.startTime}–{s.endTime}
                        <span className="inline-flex items-center gap-0.5">
                          {s.source === "MAKEUP" && <span className="rounded bg-violet-600 px-1 text-[10px] font-semibold text-white">Học bù</span>}
                          {s.source === "MANUAL" && <span className="rounded bg-sky-600 px-1 text-[10px] font-semibold text-white">Buổi thêm</span>}
                          {manage && (
                            <RowMenu>
                              {!cancelled && d <= today && (
                                <Link href={`/lop-hoc/${s.class.code}?tab=diem-danh&thang=${d.slice(0, 7)}`} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-normal text-slate-700 hover:bg-slate-50"><ClipboardCheck size={15} />Điểm danh</Link>
                              )}
                              {cancelled ? (
                                <ConfirmButton variant="menu" label="Khôi phục buổi" icon={<RotateCcw size={15} />} title="Khôi phục buổi học?" confirmLabel="Khôi phục" message={`${s.class.name} · ${fmtDate(d)} ${s.startTime}`} action={restoreSession.bind(null, s.id)} />
                              ) : (
                                <ModalButton variant="menu" label="Cho nghỉ buổi này" icon={<XCircle size={15} />} title="Cho nghỉ buổi học" subtitle={`${s.class.name} · ${fmtDate(d)} ${s.startTime}`} size="sm">
                                  <CancelSessionForm sessionId={s.id} hasAttendance={marked} />
                                </ModalButton>
                              )}
                              {s.source !== "SCHEDULE" && !marked && (
                                <ConfirmButton label="Xóa buổi này" icon={<Trash2 size={15} />} title="Xóa buổi học?" message={`${s.class.name} · ${fmtDate(d)} ${s.startTime}. Chỉ xóa được buổi bù / buổi thêm chưa điểm danh.`} action={deleteSession.bind(null, s.id)} />
                              )}
                            </RowMenu>
                          )}
                        </span>
                      </div>
                      <Link href={`/lop-hoc/${s.class.code}`} className={clsx("block font-semibold leading-snug hover:underline", cancelled && "line-through")} style={{ color: s.class.color }}>{s.class.name}</Link>
                      {s.source === "MANUAL" && s.taughtContent && <div className="text-slate-600">{s.taughtContent}</div>}
                      <div className="mt-0.5 flex items-center gap-1 text-slate-500"><MapPin size={11} />{s.class.room?.name ?? "—"} · {s.class._count.enrollments} HV</div>
                      <div className="flex items-center gap-1 text-slate-500"><User size={11} />{s.class.teacher?.fullName ?? "—"}</div>
                      {cancelled ? <div className="mt-1 text-slate-600"><b>Nghỉ</b>{s.cancelReason ? ` · ${s.cancelReason}` : ""}</div>
                        : d < today ? <span className={clsx("mt-1 inline-block font-semibold", marked ? "text-green-700" : "text-amber-600")}>{marked ? "Đã điểm danh" : "Chưa điểm danh"}</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={clsx("inline-flex items-center rounded-full px-3.5 py-1.5 font-medium ring-1 transition",
      active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50")}>
      {children}
    </Link>
  );
}
