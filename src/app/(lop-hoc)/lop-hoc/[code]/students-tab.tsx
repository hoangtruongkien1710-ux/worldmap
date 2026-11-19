import Link from "next/link";
import clsx from "clsx";
import { Pencil, Search, UserMinus, UserPlus, UserRoundPen, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { fmtDate, todayVN, toDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { ActionForm, ConfirmButton, Field, Grid, ModalButton, RowMenu } from "@/components/ui/modal";
import { StudentFields } from "@/components/classes/forms";
import { createStudent, enrollStudents, leaveEnrollment, removeEnrollment, updateEnrollment, updateStudent } from "@/lib/actions/students";
import type { classTuition } from "@/lib/tuition/summary";

type Cls = { id: string; code: string; name: string };
type SP = { q?: string; loc?: string };

export const initials = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p.length > 1 ? p[p.length - 2][0] : "") + p[p.length - 1][0]).toUpperCase();
};

export function Avatar({ name, color }: { name: string; color?: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${color ?? "#f97316"}1f`, color: color ?? "#ea580c" }}>
      {initials(name)}
    </span>
  );
}

export async function StudentsTab({ cls, sp, manage, canStudent, showMoney, tuition }: {
  cls: Cls & { color: string }; sp: SP; manage: boolean; canStudent: boolean; showMoney: boolean; tuition: Awaited<ReturnType<typeof classTuition>>;
}) {
  const [enrollments, grades, attendance] = await Promise.all([
    db.enrollment.findMany({ where: { classId: cls.id }, include: { student: { include: { grade: true } } }, orderBy: [{ status: "asc" }, { joinDate: "asc" }, { student: { fullName: "asc" } }] }),
    db.grade.findMany({ orderBy: { order: "asc" } }),
    db.attendance.groupBy({ by: ["studentId", "status"], where: { session: { classId: cls.id } }, _count: true }),
  ]);
  const filter = sp.loc === "nghi" ? "LEFT" : sp.loc === "tat-ca" ? "ALL" : "ACTIVE";
  const q = sp.q?.trim().toLowerCase();
  const rows = enrollments.filter((e) => (filter === "ALL" || e.status === filter) && (!q || e.student.fullName.toLowerCase().includes(q) || e.student.code.toLowerCase().includes(q) || e.student.parentPhone?.includes(q)));
  const count = (st: string) => enrollments.filter((e) => st === "ALL" || e.status === st).length;
  const rate = (sid: string) => {
    const a = attendance.filter((x) => x.studentId === sid);
    const total = a.reduce((s, x) => s + x._count, 0);
    const present = a.find((x) => x.status === "PRESENT")?._count ?? 0;
    return total ? { pct: (present / total) * 100, present, total } : null;
  };
  const debt = (eid: string) => tuition.find((t) => t.enrollment.id === eid)?.remain ?? 0;
  const base = `/lop-hoc/${cls.code}`;
  const link = (loc?: string) => `${base}?${new URLSearchParams({ ...(loc ? { loc } : {}), ...(sp.q ? { q: sp.q } : {}) })}`;

  const candidates = manage
    ? await db.student.findMany({ where: { status: "ACTIVE", enrollments: { none: { classId: cls.id, status: "ACTIVE" } } }, include: { grade: true }, orderBy: { fullName: "asc" } })
    : [];
  const today = todayVN();

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-4">
        <form action={base} className="relative min-w-56 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          {sp.loc && <input type="hidden" name="loc" value={sp.loc} />}
          <input name="q" defaultValue={sp.q} placeholder="Tìm học viên trong lớp…" className="input" style={{ paddingLeft: 36 }} />
        </form>
        <div className="flex rounded-xl bg-slate-100 p-1 text-sm">
          {([["ACTIVE", undefined, "Đang học"], ["LEFT", "nghi", "Đã nghỉ"], ["ALL", "tat-ca", "Tất cả"]] as const).map(([k, loc, label]) => (
            <Link key={k} href={link(loc)} className={clsx("rounded-lg px-3 py-1.5 font-semibold", filter === k ? "bg-white text-brand-600 shadow-sm" : "text-slate-500")}>
              {label} <i className="font-normal">{count(k)}</i>
            </Link>
          ))}
        </div>
        {manage && canStudent && (
          <ModalButton label="Học viên mới" icon={<UserPlus size={16} />} title="Thêm học viên mới vào lớp" subtitle={cls.name} size="lg">
            <ActionForm action={createStudent.bind(null, cls.id)} submitLabel="Thêm học viên">
              <StudentFields grades={grades} />
              <Grid>
                <Field label="Ngày vào học"><input type="date" name="joinDate" defaultValue={today} className="input" /></Field>
                <Field label="Ưu đãi (%)"><input type="number" name="percentDiscount" min={0} max={100} defaultValue={0} className="input" /></Field>
              </Grid>
            </ActionForm>
          </ModalButton>
        )}
        {manage && (
          <ModalButton variant="primary" label="Thêm học viên vào lớp" icon={<Plus size={16} />} title="Thêm học viên có sẵn vào lớp" subtitle={`Chọn một hoặc nhiều học viên · ${cls.name}`} size="lg">
            <ActionForm action={enrollStudents.bind(null, cls.id)} submitLabel="Thêm vào lớp">
              <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {candidates.length === 0 && <p className="p-4 text-sm text-slate-500">Không còn học viên nào để thêm.</p>}
                {candidates.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                    <input type="checkbox" name="studentIds" value={s.id} className="h-4 w-4 accent-brand-500" />
                    <Avatar name={s.fullName} />
                    <span className="flex-1"><b>{s.fullName}</b><span className="block text-xs text-slate-500">{s.code} · {s.grade?.name ?? ""} · {s.parentPhone ?? ""}</span></span>
                  </label>
                ))}
              </div>
              <Grid>
                <Field label="Ngày vào học"><input type="date" name="joinDate" defaultValue={today} required className="input" /></Field>
                <Field label="Ưu đãi (%)"><input type="number" name="percentDiscount" min={0} max={100} defaultValue={0} className="input" /></Field>
              </Grid>
            </ActionForm>
          </ModalButton>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-y border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th><th className="px-3 py-3">Học viên</th><th className="px-3 py-3">Phụ huynh / liên hệ</th>
              <th className="px-3 py-3">Ngày vào học</th><th className="px-3 py-3">Học đến</th><th className="px-3 py-3 text-right">Ưu đãi</th>
              <th className="px-3 py-3">Chuyên cần</th>{showMoney && <th className="px-3 py-3 text-right">Còn nợ</th>}<th className="px-3 py-3">Trạng thái</th><th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">Không có học viên.</td></tr>}
            {rows.map((e, i) => {
              const s = e.student;
              const r = rate(s.id);
              const d = debt(e.id);
              return (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.fullName} />
                      <div><Link href={`/hoc-sinh/${s.code}`} className="font-semibold hover:underline">{s.fullName}</Link><div className="text-xs text-slate-500">{s.code} · {s.grade?.name ?? "—"}</div></div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><div>{s.parentName ? `${s.parentName}${s.parentRelation ? ` (${s.parentRelation})` : ""}` : <span className="text-slate-400">Tự liên hệ</span>}</div><div className="text-xs text-slate-500">{s.parentPhone}</div></td>
                  <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(e.joinDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{e.leaveDate ? fmtDate(e.leaveDate) : "—"}</td>
                  <td className="px-3 py-2.5 text-right">{e.percentDiscount ? `${e.percentDiscount}%` : "—"}</td>
                  <td className="px-3 py-2.5">
                    {r ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className={clsx("h-full rounded-full", r.pct >= 85 ? "bg-emerald-500" : r.pct >= 70 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${r.pct}%` }} /></div>
                        <span className="w-12 text-right text-xs font-semibold">{r.pct.toFixed(1)}%</span>
                      </div>
                    ) : <span className="text-xs text-slate-400">Chưa có buổi</span>}
                  </td>
                  {showMoney && <td className="whitespace-nowrap px-3 py-2.5 text-right">{d > 0 ? <b className="text-rose-600">{money(d)}</b> : <span className="text-slate-400">—</span>}</td>}
                  <td className="px-3 py-2.5"><span className={clsx("badge", e.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500")}>{e.status === "ACTIVE" ? "Đang học" : "Đã nghỉ"}</span></td>
                  <td className="px-2 py-2.5">
                    {manage && (
                      <RowMenu>
                        {canStudent && (
                          <ModalButton variant="menu" label="Sửa hồ sơ học viên" icon={<UserRoundPen size={15} />} title={`Hồ sơ ${s.fullName}`} subtitle={s.code} size="lg">
                            <ActionForm action={updateStudent.bind(null, s.id)}><StudentFields grades={grades} s={s} withStatus /></ActionForm>
                          </ModalButton>
                        )}
                        <ModalButton variant="menu" label="Sửa ghi danh" icon={<Pencil size={15} />} title="Sửa ghi danh" subtitle={`${s.fullName} · ${cls.name}`} size="sm">
                          <ActionForm action={updateEnrollment.bind(null, e.id)}>
                            <Grid>
                              <Field label="Ngày vào học"><input type="date" name="joinDate" defaultValue={toDay(e.joinDate)} required className="input" /></Field>
                              <Field label="Ưu đãi (%)"><input type="number" name="percentDiscount" min={0} max={100} defaultValue={e.percentDiscount} className="input" /></Field>
                            </Grid>
                            <Grid>
                              <Field label="Trạng thái"><select name="status" defaultValue={e.status} className="input"><option value="ACTIVE">Đang học</option><option value="LEFT">Đã nghỉ</option></select></Field>
                              <Field label="Ngày nghỉ (nếu nghỉ)"><input type="date" name="leaveDate" defaultValue={e.leaveDate ? toDay(e.leaveDate) : ""} className="input" /></Field>
                            </Grid>
                            <p className="text-xs text-slate-400">Ưu đãi mới áp dụng cho lần chốt học phí sau. Phiếu học phí đã chốt giữ nguyên số tiền.</p>
                          </ActionForm>
                        </ModalButton>
                        {e.status === "ACTIVE" && (
                          <ModalButton variant="menu" label="Cho nghỉ học" icon={<UserMinus size={15} />} title="Cho học viên nghỉ lớp" subtitle={`${s.fullName} · ${cls.name}`} size="sm">
                            <ActionForm action={leaveEnrollment.bind(null, e.id)} submitLabel="Cho nghỉ" danger>
                              <Field label="Học đến ngày"><input type="date" name="leaveDate" defaultValue={today} required className="input" /></Field>
                              <p className="text-sm text-slate-500">Điểm danh và học phí đã thu được giữ nguyên.</p>
                            </ActionForm>
                          </ModalButton>
                        )}
                        <ConfirmButton label="Xóa khỏi lớp" icon={<Trash2 size={15} />} title="Xóa học viên khỏi lớp?"
                          message={<>Chỉ dùng khi ghi danh nhầm: <b>{s.fullName}</b> sẽ bị gỡ khỏi lớp <b>{cls.name}</b>. Không xóa được nếu đã có điểm danh hoặc đã đóng tiền.</>}
                          action={removeEnrollment.bind(null, e.id)} />
                      </RowMenu>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">Hiển thị {rows.length} / {enrollments.length} học viên</div>
    </section>
  );
}
