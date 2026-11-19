import Link from "next/link";
import clsx from "clsx";
import { BookOpen, CalendarDays, Flag, GraduationCap, MapPin, Pencil, Plus, Trash2, User, Users } from "lucide-react";
import { ActionForm, ConfirmButton, ModalButton, RowMenu } from "@/components/ui/modal";
import { ClassFields, type ClassOptions } from "@/components/classes/forms";
import { CourseFields } from "@/components/classes/course-fields";
import { loadClassOptions } from "@/lib/classes/options";
import { createClass, deleteClass, setClassStatus, updateClass } from "@/lib/actions/classes";
import { createCourse, deleteCourse, updateCourse } from "@/lib/actions/courses";
import { PageHeader } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { fmtDate, toDate, todayVN, WEEKDAY_SHORT } from "@/lib/dates";
import { money } from "@/lib/money";

export const metadata = { title: "Lớp học" };
export const dynamic = "force-dynamic";

type Search = { tab?: string; ct?: string; tt?: string };

export default async function ClassesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await guardPage("class.view");
  const sp = await searchParams;
  const tab = sp.tab === "khoa-hoc" ? "courses" : "classes";
  const showPrice = can(user.role, "tuition.view");

  const programs = await db.program.findMany({ orderBy: { order: "asc" } });
  const manage = can(user.role, "class.manage");
  const options = manage ? await loadClassOptions() : null;

  return (
    <>
      <PageHeader
        title="Lớp học"
        subtitle="Các lớp đang mở theo chương trình HSK, IELTS, TOEIC"
        actions={options && (tab === "courses" ? (
          <ModalButton variant="primary" label="Thêm khóa học" icon={<Plus size={16} />} title="Thêm khóa học vào bảng giá" size="lg">
            <ActionForm action={createCourse}><CourseFields programs={programs} /></ActionForm>
          </ModalButton>
        ) : (
          <ModalButton variant="primary" label="Tạo lớp" icon={<Plus size={16} />} title="Tạo lớp mới" subtitle="Hệ thống tự sinh các buổi học theo lịch" size="lg">
            <ActionForm action={createClass} submitLabel="Tạo lớp"><ClassFields o={options} /></ActionForm>
          </ModalButton>
        ))}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <TabLink href="/lop-hoc" active={tab === "classes"}>Danh sách lớp</TabLink>
        {showPrice && <TabLink href="/lop-hoc?tab=khoa-hoc" active={tab === "courses"}>Khóa học & học phí niêm yết</TabLink>}
      </div>
      {tab === "courses" && showPrice ? (
        <CourseCatalog manage={manage} />
      ) : (
        <ClassList
          programs={programs}
          program={sp.ct}
          status={sp.tt === "ket-thuc" ? "ENDED" : "OPEN"}
          teacherId={user.role === "TEACHER" ? user.id : undefined}
          showPrice={showPrice}
          options={options}
        />
      )}
    </>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={clsx("rounded-xl px-4 py-2 text-sm font-semibold transition",
      active ? "bg-brand-500 text-white shadow-md shadow-brand-500/25" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
      {children}
    </Link>
  );
}

async function ClassList({ programs, program, status, teacherId, showPrice, options }: {
  programs: { id: string; code: string; name: string; color: string }[];
  program?: string; status: "OPEN" | "ENDED"; teacherId?: string; showPrice: boolean; options: ClassOptions | null;
}) {
  const today = todayVN();
  const classes = await db.class.findMany({
    where: {
      status,
      ...(teacherId ? { teacherId } : {}),
      ...(program ? { course: { program: { code: program } } } : {}),
    },
    include: {
      course: { include: { program: true } },
      teacher: true,
      room: true,
      grade: true,
      schedules: { where: { validTo: null }, orderBy: { weekday: "asc" } },
      enrollments: { where: { status: status === "OPEN" ? "ACTIVE" : undefined }, select: { id: true } },
      sessions: { where: { status: "SCHEDULED", date: { lt: toDate(today) } }, select: { id: true } },
    },
    orderBy: [{ course: { program: { order: "asc" } } }, { course: { order: "asc" } }, { startDate: "desc" }],
  });

  const qs = (p?: string, t?: string) => {
    const u = new URLSearchParams();
    if (p) u.set("ct", p);
    if (t) u.set("tt", t);
    const s = u.toString();
    return `/lop-hoc${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Chip href={qs(undefined, status === "ENDED" ? "ket-thuc" : undefined)} active={!program}>Tất cả</Chip>
        {programs.map((p) => (
          <Chip key={p.id} href={qs(p.code, status === "ENDED" ? "ket-thuc" : undefined)} active={program === p.code} color={p.color}>
            {p.name}
          </Chip>
        ))}
        <span className="mx-1 w-px bg-slate-200" />
        <Chip href={qs(program)} active={status === "OPEN"}>Đang mở</Chip>
        <Chip href={qs(program, "ket-thuc")} active={status === "ENDED"}>Đã kết thúc</Chip>
      </div>

      {classes.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">Không có lớp nào.</div>}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => {
          const done = c.sessions.length;
          const total = c.totalSessions;
          const pct = total ? Math.min(100, Math.round((done / total) * 100)) : null;
          const sched = c.schedules.map((s) => `${WEEKDAY_SHORT[s.weekday]} ${s.startTime}–${s.endTime}`).join(" · ");
          return (
            <article key={c.id} className="card overflow-hidden">
              <div className="relative p-5 pb-4">
                <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: c.color }} />
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md" style={{ background: c.color }}>
                    <GraduationCap size={21} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[17px] font-bold leading-tight"><Link href={`/lop-hoc/${c.code}`} className="hover:underline">{c.name}</Link></h3>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">
                      {c.course?.program.name} · {c.course?.target ?? c.course?.description ?? c.course?.level}
                    </div>
                  </div>
                  {options && (
                    <RowMenu>
                      <ModalButton variant="menu" label="Sửa lớp" icon={<Pencil size={15} />} title={`Sửa lớp ${c.name}`} size="lg">
                        <ActionForm action={updateClass.bind(null, c.id)}><ClassFields o={options} c={c} /></ActionForm>
                      </ModalButton>
                      {c.status === "OPEN" ? (
                        <ConfirmButton variant="menu" label="Kết thúc lớp" icon={<Flag size={15} />} title="Kết thúc lớp?" confirmLabel="Kết thúc lớp"
                          message="Lớp chuyển sang “Đã kết thúc”, học viên đang học chuyển thành đã nghỉ từ hôm nay." action={setClassStatus.bind(null, c.id, "ENDED")} />
                      ) : (
                        <ConfirmButton variant="menu" label="Mở lại lớp" icon={<Flag size={15} />} title="Mở lại lớp?" confirmLabel="Mở lại" message="Lớp sẽ hiện lại trong danh sách lớp đang mở." action={setClassStatus.bind(null, c.id, "OPEN")} />
                      )}
                      <ConfirmButton label="Xóa lớp" icon={<Trash2 size={15} />} title={`Xóa lớp ${c.name}?`}
                        message="Chỉ xóa được lớp chưa điểm danh và chưa thu học phí (ví dụ tạo nhầm). Thao tác này không hoàn tác được." action={deleteClass.bind(null, c.id)} />
                    </RowMenu>
                  )}
                </div>
                <ul className="mt-4 space-y-1.5 text-[13px] text-slate-600">
                  <li className="flex items-start gap-2"><CalendarDays size={15} className="mt-0.5 shrink-0 text-violet-500" />{sched || "Chưa đặt lịch"}</li>
                  <li className="flex items-center gap-2"><User size={15} className="shrink-0 text-sky-500" />{c.teacher?.fullName ?? "Chưa phân công"}
                    <MapPin size={15} className="ml-2 shrink-0 text-rose-500" />{c.room?.name ?? "—"}</li>
                  <li className="flex items-center gap-2"><BookOpen size={15} className="shrink-0 text-amber-500" />
                    {c.course?.coursebook ? `${c.course.coursebook} · ` : ""}Khai giảng {fmtDate(c.startDate)}</li>
                </ul>
                {showPrice && c.course && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[13px]">
                    <b className="text-slate-800">{money(c.unitPrice)}</b>
                    <span className="text-slate-500">/ {c.feeMode === "PER_SESSION" ? "buổi" : "khóa"}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-center">
                <Metric value={`${c.enrollments.length}${c.maxStudents ? `/${c.maxStudents}` : ""}`} label="Học viên" icon={<Users size={13} />} />
                <Metric value={total ? `${done}/${total}` : done} label="Buổi đã học" />
                <div className="px-3 py-3">
                  {pct !== null ? (
                    <>
                      <div className="text-lg font-extrabold">{pct}%</div>
                      <div className="mx-auto mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                      </div>
                    </>
                  ) : (
                    <div className="text-lg font-extrabold">1-1</div>
                  )}
                  <div className="text-[11px] text-slate-500">Tiến độ</div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function Chip({ href, active, color, children }: { href: string; active: boolean; color?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={clsx("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium ring-1 transition",
      active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50")}>
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </Link>
  );
}

function Metric({ value, label, icon }: { value: React.ReactNode; label: string; icon?: React.ReactNode }) {
  return (
    <div className="px-3 py-3">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">{icon}{label}</div>
    </div>
  );
}

async function CourseCatalog({ manage }: { manage: boolean }) {
  const programs = await db.program.findMany({
    orderBy: { order: "asc" },
    include: { courses: { where: { active: true }, orderBy: { order: "asc" } } },
  });
  const allPrograms = programs.map(({ id, name }) => ({ id, name }));
  const range = (a?: number | null, b?: number | null) => (a && b && a !== b ? `${a}–${b}` : a ?? b ?? "");
  return (
    <div className="space-y-6">
      {programs.map((p) => (
        <section key={p.id} className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: p.color }}>
              <GraduationCap size={20} />
            </span>
            <div>
              <h2 className="text-lg font-bold">{p.name}</h2>
              <p className="text-xs text-slate-500">Bảng giá học phí niêm yết 2026 · ưu đãi áp dụng theo từng thời điểm</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Mã lớp</th><th className="px-3 py-3">Lộ trình / mục tiêu</th>
                  <th className="px-3 py-3">Thời gian</th><th className="px-3 py-3 text-right">Học phí niêm yết</th>
                  <th className="px-3 py-3">Sĩ số</th><th className="px-5 py-3">Giáo trình</th>{manage && <th className="w-12" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {p.courses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-bold">{c.code}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.target ?? c.description}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {c.priceUnit === "SESSION"
                        ? `${c.sessionHours ?? 2} tiếng/buổi · ${c.sessionsPerWeek ?? "linh hoạt"}`
                        : [c.sessionsMin && `${range(c.sessionsMin, c.sessionsMax)} buổi`, c.sessionsPerWeek && `${c.sessionsPerWeek} buổi/tuần`, c.durationText]
                            .filter(Boolean).join(" · ")}
                    </td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: p.color }}>
                      {money(c.listedPrice)} <span className="font-normal text-slate-500">/ {c.priceUnit === "SESSION" ? "buổi" : "khóa"}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{range(c.classSizeMin, c.classSizeMax)} HV</td>
                    <td className="px-5 py-3 text-slate-600">{c.coursebook ?? "—"}</td>
                    {manage && (
                      <td className="px-3 py-3 text-right">
                        <RowMenu>
                          <ModalButton variant="menu" label="Sửa khóa học" icon={<Pencil size={15} />} title={`Sửa khóa ${c.name}`} size="lg">
                            <ActionForm action={updateCourse.bind(null, c.id)}><CourseFields programs={allPrograms} c={c} /></ActionForm>
                          </ModalButton>
                          <ConfirmButton label="Xóa khóa học" icon={<Trash2 size={15} />} title={`Xóa khóa ${c.name}?`}
                            message="Nếu đã có lớp dùng khóa này, khóa chỉ bị ẩn khỏi bảng giá, các lớp cũ giữ nguyên." action={deleteCourse.bind(null, c.id)} />
                        </RowMenu>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
