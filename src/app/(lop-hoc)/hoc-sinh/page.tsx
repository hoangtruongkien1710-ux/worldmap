import Link from "next/link";
import { Phones } from "@/components/students/phones";
import clsx from "clsx";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FilterForm, FilterSelect } from "@/components/classes/filter-form";
import { monthOf, monthRange, shiftMonth, todayVN, toDate } from "@/lib/dates";
import type { Prisma } from "@prisma/client";
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

type Search = { q?: string; lop?: string; tt?: string; gv?: string; ct?: string; kh?: string; dt?: string; vh?: string; hp?: string; xep?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await guardPage("student.view");
  const sp = await searchParams;
  const showMoney = can(user.role, "tuition.view");
  const teacherId = user.role === "TEACHER" ? user.id : undefined;
  const status = sp.tt === "nghi" ? "LEFT" : sp.tt === "tat-ca" ? undefined : "ACTIVE";
  const unassigned = sp.tt === "chua-lop" && !teacherId;
  const manage = can(user.role, "student.manage");

  const [classes, teachers, programs, courses, allGrades] = await Promise.all([
    db.class.findMany({ where: teacherId ? { teacherId } : {}, orderBy: [{ status: "asc" }, { startDate: "desc" }], select: { id: true, code: true, name: true, color: true, status: true } }),
    teacherId ? [] : db.user.findMany({ where: { role: "TEACHER" }, orderBy: { fullName: "asc" }, select: { id: true, username: true, fullName: true } }),
    db.program.findMany({ orderBy: { order: "asc" } }),
    db.course.findMany({ orderBy: [{ program: { order: "asc" } }, { order: "asc" }] }),
    db.grade.findMany({ orderBy: { order: "asc" } }),
  ]);
  const cls = classes.find((c) => c.code === sp.lop);
  const teacher = teachers.find((t) => t.username === sp.gv);
  const grade = allGrades.find((g) => String(g.id) === sp.dt);
  const q = sp.q?.trim();
  const thisMonth = monthOf(todayVN());
  const joinRange = (() => {
    const k = sp.vh;
    if (k === "3-thang") return { from: `${shiftMonth(thisMonth, -2)}-01`, to: monthRange(thisMonth).to };
    if (k && /^\d{4}-\d{2}$/.test(k)) return monthRange(k);
    return null;
  })();

  // Điều kiện trên ghi danh: trạng thái, lớp, giáo viên, khóa học, thời gian vào học.
  const en: Prisma.EnrollmentWhereInput = {
    ...(status ? { status } : {}),
    ...(cls ? { classId: cls.id } : {}),
    ...(teacherId ? { class: { teacherId } } : teacher ? { class: { teacherId: teacher.id } } : {}),
    ...(sp.kh ? { class: { ...(teacherId ? { teacherId } : teacher ? { teacherId: teacher.id } : {}), course: { code: sp.kh } } } : sp.ct ? { class: { ...(teacherId ? { teacherId } : teacher ? { teacherId: teacher.id } : {}), course: { program: { code: sp.ct } } } } : {}),
    ...(joinRange ? { joinDate: { gte: toDate(joinRange.from), lte: toDate(joinRange.to) } } : {}),
  };
  const found = await db.student.findMany({
    where: {
      ...(unassigned ? { enrollments: { none: {} } } : { enrollments: { some: en } }),
      ...(grade ? { gradeId: grade.id } : {}),
      ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { parentPhone: { contains: q } }, { phone: { contains: q } }, { parentName: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: {
      grade: true,
      enrollments: { include: { class: { select: { id: true, code: true, name: true, color: true, teacherId: true } } }, orderBy: { joinDate: "desc" } },
      attendance: { select: { status: true } },
    },
    orderBy: { code: "asc" },
  });
  const invoices = showMoney ? await loadInvoices({ studentId: { in: found.map((s) => s.id) } }) : [];
  const debt = (id: string) => invoices.filter((i) => i.studentId === id).reduce((s, i) => s + i.remain, 0);
  const rateOf = (s: (typeof found)[number]) => (s.attendance.length ? s.attendance.filter((a) => a.status === "PRESENT").length / s.attendance.length : 1);
  const students = found
    .filter((s) => !showMoney || !sp.hp || (sp.hp === "con-no" ? debt(s.id) > 0 : debt(s.id) === 0))
    .sort((a, b) => sp.xep === "ten" ? a.fullName.split(" ").at(-1)!.localeCompare(b.fullName.split(" ").at(-1)!, "vi") || a.fullName.localeCompare(b.fullName, "vi")
      : sp.xep === "no" && showMoney ? debt(b.id) - debt(a.id)
      : sp.xep === "chuyen-can" ? rateOf(a) - rateOf(b)
      : a.code.localeCompare(b.code));
  const totalDebt = showMoney ? students.reduce((s, x) => s + debt(x.id), 0) : 0;
  const filtered = !!(q || sp.lop || sp.gv || sp.ct || sp.kh || sp.dt || sp.vh || sp.hp || sp.xep || (sp.tt && sp.tt !== "dang-hoc"));
  const joinMonths = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth, -i));
  const grades = allGrades;
  const openClasses = classes.filter((c) => c.status === "OPEN");

  return (
    <>
      <PageHeader title="Học viên" subtitle={`${students.length} học viên ${unassigned ? "chưa xếp lớp" : status === "ACTIVE" ? "đang học" : status === "LEFT" ? "đã nghỉ / kết thúc khóa" : ""}${cls ? ` · lớp ${cls.name}` : ""}`}
        actions={manage && (
          <ModalButton variant="primary" label="Học viên mới" icon={<Plus size={16} />} title="Thêm học viên mới" subtitle="Mã học viên được tạo tự động" size="lg">
            <ActionForm action={createStudent.bind(null, null)} submitLabel="Thêm học viên">
              <StudentFields grades={grades} />
              <EnrollFields classes={openClasses} optional />
            </ActionForm>
          </ModalButton>
        )} />

      <FilterForm action="/hoc-sinh" resetHref="/hoc-sinh" active={filtered}>
        <label className="col-span-2 block min-w-0">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Tìm học viên</span>
          <input name="q" defaultValue={sp.q} placeholder="Tên, mã HV, tên hoặc SĐT phụ huynh" className="input w-full" />
        </label>
        <FilterSelect label="Tình trạng" name="tt" value={sp.tt ?? "dang-hoc"}>
          <option value="dang-hoc">Đang học</option>
          <option value="nghi">Đã nghỉ / xong khóa</option>
          {!teacherId && <option value="chua-lop">Chưa xếp lớp</option>}
          <option value="tat-ca">Tất cả</option>
        </FilterSelect>
        <FilterSelect label="Lớp" name="lop" value={sp.lop}>
          <option value="">Tất cả lớp</option>
          <optgroup label="Đang mở">{classes.filter((c) => c.status === "OPEN").map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}</optgroup>
          <optgroup label="Đã kết thúc">{classes.filter((c) => c.status !== "OPEN").map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}</optgroup>
        </FilterSelect>
        {!teacherId && (
          <FilterSelect label="Giáo viên" name="gv" value={sp.gv}>
            <option value="">Tất cả giáo viên</option>
            {teachers.map((t) => <option key={t.id} value={t.username}>{t.fullName}</option>)}
          </FilterSelect>
        )}
        <FilterSelect label="Chương trình" name="ct" value={sp.ct}>
          <option value="">Tất cả chương trình</option>
          {programs.map((p) => <option key={p.id} value={p.code}>{p.name}</option>)}
        </FilterSelect>
        <FilterSelect label="Khóa học" name="kh" value={sp.kh}>
          <option value="">Tất cả khóa học</option>
          {programs.map((p) => (
            <optgroup key={p.id} label={p.name}>
              {courses.filter((k) => k.programId === p.id && (!sp.ct || p.code === sp.ct)).map((k) => <option key={k.id} value={k.code}>{k.name}</option>)}
            </optgroup>
          ))}
        </FilterSelect>
        <FilterSelect label="Đối tượng" name="dt" value={sp.dt}>
          <option value="">Tất cả đối tượng</option>
          {allGrades.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
        </FilterSelect>
        <FilterSelect label="Thời gian vào học" name="vh" value={sp.vh}>
          <option value="">Mọi thời gian</option>
          <option value="3-thang">3 tháng gần đây</option>
          {joinMonths.map((m) => <option key={m} value={m}>Tháng {m.slice(5)}/{m.slice(0, 4)}</option>)}
        </FilterSelect>
        {showMoney && (
          <FilterSelect label="Học phí" name="hp" value={sp.hp}>
            <option value="">Tất cả</option>
            <option value="con-no">Còn nợ</option>
            <option value="du">Đã đóng đủ</option>
          </FilterSelect>
        )}
        <FilterSelect label="Sắp xếp" name="xep" value={sp.xep}>
          <option value="">Theo mã học viên</option>
          <option value="ten">Theo tên (A–Z)</option>
          {showMoney && <option value="no">Còn nợ nhiều nhất</option>}
          <option value="chuyen-can">Chuyên cần thấp nhất</option>
        </FilterSelect>
      </FilterForm>
      {showMoney && students.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200">
          <span><b>{students.length}</b> học viên</span>
          <span><b>{students.filter((x) => debt(x.id) > 0).length}</b> học viên còn nợ</span>
          <span>Tổng còn nợ <b className="text-rose-600">{money(totalDebt)}</b></span>
        </div>
      )}

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
                    <td className="px-3 py-2.5"><div>{s.parentName ?? <span className="text-slate-400">Tự liên hệ</span>}{s.parentRelation ? <span className="text-xs text-slate-500"> ({s.parentRelation})</span> : null}</div><Phones s={s} /></td>
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
