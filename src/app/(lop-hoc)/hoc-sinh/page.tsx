import Link from "next/link";
import clsx from "clsx";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { ActionForm, ConfirmButton, ModalButton, RowMenu } from "@/components/ui/modal";
import { StudentFields } from "@/components/classes/forms";
import { EnrollFields } from "@/components/classes/enroll-fields";
import { createStudent, deleteStudent, updateStudent } from "@/lib/actions/students";
import { PageHeader } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadInvoices } from "@/lib/tuition/summary";
import { money } from "@/lib/money";

export const metadata = { title: "Học viên" };
export const dynamic = "force-dynamic";

type Search = { q?: string; lop?: string; tt?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await guardPage("student.view");
  const sp = await searchParams;
  const showMoney = can(user.role, "tuition.view");
  const teacherId = user.role === "TEACHER" ? user.id : undefined;
  const status = sp.tt === "nghi" ? "LEFT" : "ACTIVE";
  const unassigned = sp.tt === "chua-lop" && !teacherId;
  const manage = can(user.role, "student.manage");

  const classes = await db.class.findMany({
    where: teacherId ? { teacherId } : {},
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    select: { id: true, code: true, name: true, color: true, status: true },
  });
  const cls = classes.find((c) => c.code === sp.lop);
  const q = sp.q?.trim();

  const students = await db.student.findMany({
    where: {
      ...(unassigned ? { enrollments: { none: {} } } : { enrollments: { some: { status, ...(cls ? { classId: cls.id } : teacherId ? { class: { teacherId } } : {}) } } }),
      ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { parentPhone: { contains: q } }] } : {}),
    },
    include: {
      grade: true,
      enrollments: { include: { class: { select: { id: true, code: true, name: true, color: true, teacherId: true } } }, orderBy: { joinDate: "desc" } },
      attendance: { select: { status: true } },
    },
    orderBy: { code: "asc" },
  });
  const grades = manage ? await db.grade.findMany({ orderBy: { order: "asc" } }) : [];
  const openClasses = classes.filter((c) => c.status === "OPEN");
  const invoices = showMoney ? await loadInvoices({ studentId: { in: students.map((s) => s.id) } }) : [];
  const debt = (id: string) => invoices.filter((i) => i.studentId === id).reduce((s, i) => s + i.remain, 0);

  const qs = (o: Partial<Search>) => {
    const u = new URLSearchParams();
    const m = { q: sp.q, lop: sp.lop, tt: sp.tt, ...o };
    for (const [k, v] of Object.entries(m)) if (v) u.set(k, v);
    const s = u.toString();
    return `/hoc-sinh${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Học viên" subtitle={`${students.length} học viên ${unassigned ? "chưa xếp lớp" : status === "ACTIVE" ? "đang học" : "đã nghỉ / kết thúc khóa"}${cls ? ` · lớp ${cls.name}` : ""}`}
        actions={manage && (
          <ModalButton variant="primary" label="Học viên mới" icon={<Plus size={16} />} title="Thêm học viên mới" subtitle="Mã học viên được tạo tự động" size="lg">
            <ActionForm action={createStudent.bind(null, null)} submitLabel="Thêm học viên">
              <StudentFields grades={grades} />
              <EnrollFields classes={openClasses} optional />
            </ActionForm>
          </ModalButton>
        )} />

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/hoc-sinh">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={sp.q} placeholder="Tìm tên, mã học viên, SĐT phụ huynh" className="input" style={{ paddingLeft: 36 }} />
        </div>
        {sp.lop && <input type="hidden" name="lop" value={sp.lop} />}
        {sp.tt && <input type="hidden" name="tt" value={sp.tt} />}
        <button className="btn">Tìm</button>
        <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
        <Chip href={qs({ tt: undefined })} active={status === "ACTIVE" && !unassigned}>Đang học</Chip>
        <Chip href={qs({ tt: "nghi" })} active={status === "LEFT" && !unassigned}>Đã nghỉ / xong khóa</Chip>
        {!teacherId && <Chip href={qs({ tt: "chua-lop", lop: undefined })} active={unassigned}>Chưa xếp lớp</Chip>}
      </form>
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Chip href={qs({ lop: undefined })} active={!cls}>Tất cả lớp</Chip>
        {classes.filter((c) => c.status === "OPEN" || c.code === sp.lop).map((c) => (
          <Chip key={c.id} href={qs({ lop: c.code })} active={cls?.id === c.id} color={c.color}>{c.code}</Chip>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Học viên</th><th className="px-3 py-3">Đối tượng</th><th className="px-3 py-3">Phụ huynh / liên hệ</th>
                <th className="px-3 py-3">Lớp</th><th className="px-3 py-3 text-right">Chuyên cần</th>
                {showMoney && <th className="px-4 py-3 text-right">Còn nợ</th>}
                {manage && <th className="w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Không có học viên phù hợp.</td></tr>}
              {students.map((s) => {
                const total = s.attendance.length;
                const present = s.attendance.filter((a) => a.status === "PRESENT").length;
                const rate = total ? Math.round((present / total) * 100) : null;
                const d = debt(s.id);
                const ens = s.enrollments.filter((e) => !teacherId || e.class.teacherId === teacherId);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <Link href={`/hoc-sinh/${s.code}`} className="font-semibold text-slate-900 hover:text-brand-600 hover:underline">{s.fullName}</Link>
                      <div className="text-xs text-slate-500">{s.code}{s.school ? ` · ${s.school}` : ""}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{s.grade?.name ?? "—"}</td>
                    <td className="px-3 py-2.5"><div>{s.parentName ?? <span className="text-slate-400">Tự liên hệ</span>}{s.parentRelation ? <span className="text-xs text-slate-500"> ({s.parentRelation})</span> : null}</div><div className="text-xs text-slate-500">{s.parentPhone}</div></td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {ens.map((e) => (
                          <span key={e.id} className={clsx("badge gap-1 bg-slate-100 text-slate-700", e.status === "LEFT" && "opacity-60")}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.class.color }} />{e.class.code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {rate === null ? <span className="text-slate-400">—</span> : <span className={clsx("font-semibold", rate >= 85 ? "text-emerald-700" : rate >= 70 ? "text-amber-600" : "text-rose-600")}>{rate}%</span>}
                      <div className="text-xs text-slate-400">{present}/{total} buổi</div>
                    </td>
                    {showMoney && <td className="whitespace-nowrap px-4 py-2.5 text-right">{d > 0 ? <b className="text-rose-600">{money(d)}</b> : <span className="badge bg-green-50 text-green-700">Đã đủ</span>}</td>}
                    {manage && (
                      <td className="px-2 py-2.5 text-right">
                        <RowMenu>
                          <ModalButton variant="menu" label="Sửa hồ sơ" icon={<Pencil size={15} />} title={`Sửa hồ sơ ${s.fullName}`} subtitle={s.code} size="lg">
                            <ActionForm action={updateStudent.bind(null, s.id)}><StudentFields grades={grades} s={s} withStatus /></ActionForm>
                          </ModalButton>
                          <ConfirmButton label="Xóa học viên" icon={<Trash2 size={15} />} title={`Xóa học viên ${s.fullName}?`}
                            message="Chỉ xóa được học viên tạo nhầm (chưa điểm danh, chưa có học phí). Thao tác này không hoàn tác được." action={deleteStudent.bind(null, s.id)} />
                        </RowMenu>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Bấm vào tên để xem hồ sơ. Học viên mới chưa ghi danh nằm ở mục “Chưa xếp lớp”.</p>
    </>
  );
}

function Chip({ href, active, color, children }: { href: string; active: boolean; color?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={clsx("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition",
      active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50")}>
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </Link>
  );
}
