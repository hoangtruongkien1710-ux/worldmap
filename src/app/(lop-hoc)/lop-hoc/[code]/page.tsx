import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, CalendarDays, CalendarPlus, ClipboardCheck, Flag, HandCoins, MapPin, Pencil, Presentation, Receipt, Trash2, User, Users } from "lucide-react";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { fmtDate, todayVN, WEEKDAY_SHORT } from "@/lib/dates";
import { money } from "@/lib/money";
import { classTuition } from "@/lib/tuition/summary";
import { loadClassOptions } from "@/lib/classes/options";
import { ActionForm, ConfirmButton, ModalButton, RowMenu } from "@/components/ui/modal";
import { ClassFields } from "@/components/classes/forms";
import { AddSessionForm } from "@/components/classes/session-forms";
import { StudentsTab } from "./students-tab";
import { AttendanceTab } from "./attendance-tab";
import { TuitionTab } from "./tuition-tab";
import { deleteClass, setClassStatus, updateClass } from "@/lib/actions/classes";

export const dynamic = "force-dynamic";

type SP = { tab?: string; thang?: string; q?: string; loc?: string };

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  return { title: decodeURIComponent((await params).code) };
}

export default async function Page({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SP> }) {
  const user = await guardPage("class.view");
  const { code } = await params;
  const sp = await searchParams;
  const c = await db.class.findUnique({
    where: { code: decodeURIComponent(code) },
    include: {
      course: { include: { program: true } }, teacher: true, room: true, grade: true,
      schedules: { where: { validTo: null }, orderBy: { weekday: "asc" } },
      enrollments: { select: { status: true } },
    },
  });
  if (!c) notFound();
  if (user.role === "TEACHER" && c.teacherId !== user.id) notFound();
  const today = todayVN();
  const manage = can(user.role, "class.manage");
  const money_ = can(user.role, "tuition.view");
  const tab = sp.tab === "diem-danh" ? "att" : sp.tab === "hoc-phi" && money_ ? "fee" : sp.tab === "cong-no" && money_ ? "debt" : "stu";
  const activeCount = c.enrollments.filter((e) => e.status === "ACTIVE").length;
  const tuition = money_ ? await classTuition(c.id, today) : [];
  const debtors = tuition.filter((t) => t.remain > 0).length;

  const options = manage ? await loadClassOptions() : null;

  const sched = c.schedules.map((s) => `${WEEKDAY_SHORT[s.weekday]} ${s.startTime}–${s.endTime}`).join(" · ");
  const href = (t: string) => `/lop-hoc/${c.code}${t ? `?tab=${t}` : ""}`;
  const tabs = [
    { key: "stu", href: href(""), label: "Học viên", icon: <Users size={16} />, count: activeCount },
    { key: "att", href: href("diem-danh"), label: "Điểm danh", icon: <ClipboardCheck size={16} /> },
    ...(money_ ? [
      { key: "fee", href: href("hoc-phi"), label: "Học phí", icon: <Receipt size={16} /> },
      { key: "debt", href: href("cong-no"), label: "Công nợ", icon: <HandCoins size={16} />, count: debtors },
    ] : []),
  ];

  return (
    <>
      <section className="card mb-5 overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 p-5" style={{ background: `linear-gradient(90deg, ${c.color}14, transparent 70%)` }}>
          <Link href="/lop-hoc" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50" aria-label="Quay lại"><ArrowLeft size={19} /></Link>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-md" style={{ background: c.color }}><Presentation size={22} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">{c.name}</h1>
              <span className={clsx("badge", c.status === "OPEN" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500")}>{c.status === "OPEN" ? "Đang mở" : "Đã kết thúc"}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-600">
              <span className="inline-flex items-center gap-1"><CalendarDays size={14} className="text-slate-400" />{sched || "Chưa có lịch"}</span>
              <span className="inline-flex items-center gap-1"><User size={14} className="text-slate-400" />{c.teacher?.fullName ?? "Chưa phân công"}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={14} className="text-slate-400" />{c.room?.name ?? "—"}</span>
              <span className="inline-flex items-center gap-1"><Flag size={14} className="text-slate-400" />Từ {fmtDate(c.startDate)}{c.endDate ? ` đến ${fmtDate(c.endDate)}` : ""}</span>
              {money_ && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="badge bg-amber-50 text-amber-700">{c.feeMode === "PER_SESSION" ? "Theo số buổi học" : `Trọn khóa${c.totalSessions ? ` ${c.totalSessions} buổi` : ""}`}</span>
                  {money(c.unitPrice)}/{c.feeMode === "PER_SESSION" ? "buổi" : "khóa"}
                </span>
              )}
            </div>
          </div>
          {manage && options && (
            <div className="flex gap-2">
              <ModalButton label="Sửa lớp" icon={<Pencil size={16} />} title={`Sửa lớp ${c.name}`} size="lg">
                <ActionForm action={updateClass.bind(null, c.id)}>
                  <ClassFields o={options} c={c} />
                </ActionForm>
              </ModalButton>
              <RowMenu label={<span className="px-0.5">⋮</span>}>
                <ModalButton variant="menu" label="Thêm buổi học bù" icon={<CalendarPlus size={15} />} title="Thêm buổi học bù / buổi thêm" subtitle={c.name} size="sm">
                  <AddSessionForm classId={c.id} defaultStart={c.schedules[0]?.startTime} defaultEnd={c.schedules[0]?.endTime} />
                </ModalButton>
                {c.status === "OPEN" ? (
                  <ConfirmButton variant="menu" label="Kết thúc lớp" icon={<Flag size={15} />} title="Kết thúc lớp?" confirmLabel="Kết thúc lớp"
                    message="Lớp chuyển sang “Đã kết thúc”, học viên đang học chuyển thành đã nghỉ từ hôm nay. Dữ liệu điểm danh và học phí được giữ nguyên."
                    action={setClassStatus.bind(null, c.id, "ENDED")} />
                ) : (
                  <ConfirmButton variant="menu" label="Mở lại lớp" icon={<Flag size={15} />} title="Mở lại lớp?" confirmLabel="Mở lại" message="Lớp sẽ hiện lại trong danh sách lớp đang mở." action={setClassStatus.bind(null, c.id, "OPEN")} />
                )}
                <ConfirmButton label="Xóa lớp" icon={<Trash2 size={15} />} title={`Xóa lớp ${c.name}?`}
                  message="Chỉ xóa được lớp chưa điểm danh và chưa thu học phí (ví dụ tạo nhầm). Thao tác này không hoàn tác được."
                  action={deleteClass.bind(null, c.id)} />
              </RowMenu>
            </div>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3">
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} className={clsx("inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition",
              tab === t.key ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-800")}>
              {t.icon}{t.label}
              {t.count !== undefined && <span className={clsx("rounded-md px-1.5 text-xs", tab === t.key ? "bg-brand-50" : "bg-slate-100")}>{t.count}</span>}
            </Link>
          ))}
        </nav>
      </section>

      {tab === "stu" && <StudentsTab cls={c} sp={sp} manage={manage} canStudent={can(user.role, "student.manage")} showMoney={money_} tuition={tuition} />}
      {tab === "att" && <AttendanceTab cls={c} month={sp.thang} canTake={can(user.role, "attendance.take")} manage={manage} />}
      {(tab === "fee" || tab === "debt") && <TuitionTab cls={c} rows={tuition} sp={sp} debtOnly={tab === "debt"} canCollect={can(user.role, "tuition.collect")} />}
    </>
  );
}
