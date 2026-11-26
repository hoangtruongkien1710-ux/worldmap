import Link from "next/link";
import { MaterialsList } from "@/components/classes/materials";
import clsx from "clsx";
import { BookOpen, CalendarDays, Flag, GraduationCap, MapPin, Pencil, Plus, Trash2, User, Users } from "lucide-react";
import { ActionForm, ConfirmButton, ModalButton, RowMenu } from "@/components/ui/modal";
import { ClassFields, type ClassOptions } from "@/components/classes/forms";
import { CourseFields } from "@/components/classes/course-fields";
import { loadClassOptions } from "@/lib/classes/options";
import { FilterForm, FilterSelect } from "@/components/classes/filter-form";
import { classTuition } from "@/lib/tuition/summary";
import { monthOf, monthRange, shiftMonth, toDay } from "@/lib/dates";
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

type Search = { tab?: string; ct?: string; tt?: string; gv?: string; kh?: string; kg?: string; hp?: string; q?: string };

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
          sp={sp}
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

async function ClassList({ programs, sp, teacherId, showPrice, options }: {
  programs: { id: string; code: string; name: string; color: string }[];
  sp: Search; teacherId?: string; showPrice: boolean; options: ClassOptions | null;
}) {
  const today = todayVN();
  const status = sp.tt === "ket-thuc" ? "ENDED" : sp.tt === "tat-ca" ? undefined : "OPEN";
  const [teachers, courses, starts] = await Promise.all([
    teacherId ? [] : db.user.findMany({ where: { role: "TEACHER" }, orderBy: { fullName: "asc" }, select: { id: true, username: true, fullName: true, active: true } }),
    db.course.findMany({ include: { program: true }, orderBy: [{ program: { order: "asc" } }, { order: "asc" }] }),
    db.class.findMany({ select: { startDate: true }, orderBy: { startDate: "desc" } }),
  ]);
  const startMonths = [...new Set(starts.map((c) => monthOf(toDay(c.startDate))))];
  const thisMonth = monthOf(today);
  // Khoảng thời gian khai giảng
  const range = (() => {
    const k = sp.kg;
    if (!k) return null;
    if (k === "3-thang") return { from: `${shiftMonth(thisMonth, -2)}-01`, to: monthRange(thisMonth).to };
    if (k === "6-thang") return { from: `${shiftMonth(thisMonth, -5)}-01`, to: monthRange(thisMonth).to };
    if (/^nam-\d{4}$/.test(k)) return { from: `${k.slice(4)}-01-01`, to: `${k.slice(4)}-12-31` };
    if (/^\d{4}-\d{2}$/.test(k)) return monthRange(k);
    return null;
  })();
  const teacher = teachers.find((t) => t.username === sp.gv);
  const q = sp.q?.trim();

  const all = await db.class.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(teacherId ? { teacherId } : teacher ? { teacherId: teacher.id } : sp.gv === "chua-co" ? { teacherId: null } : {}),
      ...(sp.ct ? { course: { program: { code: sp.ct } } } : {}),
      ...(sp.kh ? { course: { code: sp.kh } } : {}),
      ...(range ? { startDate: { gte: toDate(range.from), lte: toDate(range.to) } } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: {
      course: { include: { program: true } },
      teacher: true,
      room: true,
      grade: true,
      schedules: { where: { validTo: null }, orderBy: { weekday: "asc" } },
      enrollments: { select: { id: true, status: true } },
      sessions: { where: { status: "SCHEDULED", date: { lt: toDate(today) } }, select: { id: true } },
    },
    orderBy: [{ course: { program: { order: "asc" } } }, { course: { order: "asc" } }, { startDate: "desc" }],
  });
  // Học phí từng lớp: cùng cách tính với tab Học phí trong chi tiết lớp.
  const fees = new Map<string, { due: number; paid: number; remain: number; debtors: number }>();
  if (showPrice) {
    await Promise.all(all.map(async (c) => {
      const rows = await classTuition(c.id, today);
      fees.set(c.id, { due: rows.reduce((s, r) => s + r.due, 0), paid: rows.reduce((s, r) => s + r.paid, 0), remain: rows.reduce((s, r) => s + r.remain, 0), debtors: rows.filter((r) => r.remain > 0).length });
    }));
  }
  const classes = all.filter((c) => !showPrice || !sp.hp ? true : sp.hp === "con-no" ? (fees.get(c.id)?.remain ?? 0) > 0 : (fees.get(c.id)?.remain ?? 0) === 0);
  const sumFee = (k: "due" | "paid" | "remain") => classes.reduce((s, c) => s + (fees.get(c.id)?.[k] ?? 0), 0);
  const filtered = !!(sp.ct || sp.kh || sp.kg || sp.gv || sp.hp || q || (sp.tt && sp.tt !== "mo"));

  return (
    <>
      <FilterForm action="/lop-hoc" resetHref="/lop-hoc" active={filtered}>
        <label className="col-span-2 block min-w-0 sm:col-span-1">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Tìm lớp</span>
          <input name="q" defaultValue={sp.q} placeholder="Tên hoặc mã lớp" className="input w-full" />
        </label>
        <FilterSelect label="Thời gian khai giảng" name="kg" value={sp.kg}>
          <option value="">Mọi thời gian</option>
          <option value={thisMonth}>Tháng này</option>
          <option value="3-thang">3 tháng gần đây</option>
          <option value="6-thang">6 tháng gần đây</option>
          <option value={`nam-${thisMonth.slice(0, 4)}`}>Năm {thisMonth.slice(0, 4)}</option>
          <optgroup label="Theo tháng">
            {startMonths.map((m) => <option key={m} value={m}>Tháng {m.slice(5)}/{m.slice(0, 4)}</option>)}
          </optgroup>
        </FilterSelect>
        {!teacherId && (
          <FilterSelect label="Giáo viên" name="gv" value={sp.gv}>
            <option value="">Tất cả giáo viên</option>
            {teachers.map((t) => <option key={t.id} value={t.username}>{t.fullName}{t.active ? "" : " (đã khóa)"}</option>)}
            <option value="chua-co">Chưa phân công</option>
          </FilterSelect>
        )}
        <FilterSelect label="Tình trạng lớp" name="tt" value={sp.tt ?? "mo"}>
          <option value="mo">Đang mở</option>
          <option value="ket-thuc">Đã kết thúc</option>
          <option value="tat-ca">Tất cả</option>
        </FilterSelect>
        <FilterSelect label="Chương trình" name="ct" value={sp.ct}>
          <option value="">Tất cả chương trình</option>
          {programs.map((p) => <option key={p.id} value={p.code}>{p.name}</option>)}
        </FilterSelect>
        <FilterSelect label="Khóa học" name="kh" value={sp.kh}>
          <option value="">Tất cả khóa học</option>
          {programs.map((p) => (
            <optgroup key={p.id} label={p.name}>
              {courses.filter((k) => k.programId === p.id && (!sp.ct || p.code === sp.ct)).map((k) => <option key={k.id} value={k.code}>{k.name}{k.active ? "" : " (ngừng)"}</option>)}
            </optgroup>
          ))}
        </FilterSelect>
        {showPrice && (
          <FilterSelect label="Học phí" name="hp" value={sp.hp}>
            <option value="">Tất cả</option>
            <option value="con-no">Còn học phí chưa thu</option>
            <option value="du">Đã thu đủ</option>
          </FilterSelect>
        )}
      </FilterForm>

      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200">
        <span><b>{classes.length}</b> lớp</span>
        <span><b>{classes.reduce((s, c) => s + c.enrollments.filter((e) => e.status === "ACTIVE").length, 0)}</b> học viên đang học</span>
        {showPrice && (
          <>
            <span>Phải thu <b>{money(sumFee("due"))}</b></span>
            <span>Đã thu <b className="text-emerald-700">{money(sumFee("paid"))}</b></span>
            <span>Chưa thu <b className="text-rose-600">{money(sumFee("remain"))}</b></span>
          </>
        )}
      </div>

      {classes.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">Không có lớp nào.</div>}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => {
          const done = c.sessions.length;
          const fee = fees.get(c.id);
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
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[13px]">
                      <b className="text-slate-800">{money(c.unitPrice)}</b>
                      <span className="text-slate-500">/ {c.feeMode === "PER_SESSION" ? "buổi" : "khóa"}</span>
                    </span>
                    {c.status === "ENDED" && <span className="badge bg-slate-100 text-slate-500">Đã kết thúc</span>}
                  </div>
                )}
                {showPrice && fee && (
                  <Link href={`/lop-hoc/${c.code}?tab=${fee.remain ? "cong-no" : "hoc-phi"}`} className={clsx("mt-3 block rounded-xl px-3 py-2 text-[13px] ring-1 transition hover:brightness-95", fee.remain ? "bg-rose-50 ring-rose-100" : "bg-emerald-50 ring-emerald-100")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={fee.remain ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}>{fee.remain ? `Chưa thu ${money(fee.remain)}` : fee.due ? "Đã thu đủ học phí" : "Chưa phát sinh học phí"}</span>
                      {fee.remain > 0 && <span className="text-xs text-rose-600">{fee.debtors} học viên</span>}
                    </div>
                    {fee.due > 0 && (
                      <>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((fee.paid / fee.due) * 100)}%` }} /></div>
                        <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>Đã thu {money(fee.paid)}</span><span>Phải thu {money(fee.due)}</span></div>
                      </>
                    )}
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-center">
                <Metric value={`${c.enrollments.filter((e) => e.status === "ACTIVE").length}${c.maxStudents ? `/${c.maxStudents}` : ""}`} label="Học viên" icon={<Users size={13} />} />
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
    include: { courses: { where: { active: true }, orderBy: { order: "asc" }, include: { materials: { orderBy: { createdAt: "asc" } } } } },
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
                    <td className="px-5 py-3 text-slate-600"><div>{c.coursebook ?? "—"}</div><div className="mt-1"><MaterialsList items={c.materials} courseId={c.id} courseName={c.name} manage={manage} compact /></div></td>
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
