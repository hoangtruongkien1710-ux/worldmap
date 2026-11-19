import Link from "next/link";
import clsx from "clsx";
import { CalendarPlus, ChevronLeft, ChevronRight, RotateCcw, Ban, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { fmtDate, monthOf, monthRange, shiftMonth, todayVN, toDate, toDay, WEEKDAY_SHORT, weekday } from "@/lib/dates";
import { ActionForm, ConfirmButton, Field, Grid, ModalButton, RowMenu } from "@/components/ui/modal";
import { AddSessionForm, CancelSessionForm } from "@/components/classes/session-forms";
import { AllPresentButton } from "@/components/classes/client";
import { deleteSession, restoreSession, saveAttendance } from "@/lib/actions/sessions";
import { Avatar } from "./students-tab";

const MARK: Record<string, { t: string; cls: string; label: string }> = {
  PRESENT: { t: "C", cls: "bg-emerald-50 text-emerald-700", label: "Có mặt" },
  EXCUSED: { t: "P", cls: "bg-amber-50 text-amber-700", label: "Vắng phép" },
  ABSENT: { t: "V", cls: "bg-rose-50 text-rose-700", label: "Vắng" },
};

const PICK: Record<string, string> = {
  PRESENT: "peer-checked:bg-emerald-500 peer-checked:text-white peer-checked:ring-emerald-500",
  EXCUSED: "peer-checked:bg-amber-500 peer-checked:text-white peer-checked:ring-amber-500",
  ABSENT: "peer-checked:bg-rose-500 peer-checked:text-white peer-checked:ring-rose-500",
};

export async function AttendanceTab({ cls, month: m, canTake, manage }: {
  cls: { id: string; code: string; name: string; color: string; schedules: { startTime: string; endTime: string }[] }; month?: string; canTake: boolean; manage: boolean;
}) {
  const today = todayVN();
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : monthOf(today);
  const { from, to } = monthRange(month);
  const [sessions, enrollments] = await Promise.all([
    db.session.findMany({
      where: { classId: cls.id, date: { gte: toDate(from), lte: toDate(to) } },
      include: { attendance: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    db.enrollment.findMany({
      where: { classId: cls.id, joinDate: { lte: toDate(to) }, OR: [{ leaveDate: null }, { leaveDate: { gte: toDate(from) } }] },
      include: { student: true },
      orderBy: { student: { fullName: "asc" } },
    }),
  ]);
  const held = sessions.filter((s) => s.status === "SCHEDULED");
  const past = held.filter((s) => toDay(s.date) <= today);
  const inSession = (e: (typeof enrollments)[number], d: Date) => e.joinDate <= d && (!e.leaveDate || e.leaveDate >= d);
  const href = (mm: string) => `/lop-hoc/${cls.code}?tab=diem-danh&thang=${mm}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-xl bg-white ring-1 ring-slate-200">
          <Link href={href(shiftMonth(month, -1))} className="rounded-l-xl p-3 text-slate-500 hover:bg-slate-50" aria-label="Tháng trước"><ChevronLeft size={18} /></Link>
          <div className="min-w-40 px-2 text-center"><div className="font-bold">Tháng {month.slice(5)}/{month.slice(0, 4)}</div><div className="text-xs text-slate-500">{fmtDate(from)} – {fmtDate(to)}</div></div>
          <Link href={href(shiftMonth(month, 1))} className="rounded-r-xl p-3 text-slate-500 hover:bg-slate-50" aria-label="Tháng sau"><ChevronRight size={18} /></Link>
        </div>
        <div className="flex flex-1 flex-wrap justify-center gap-4 text-sm text-slate-600">
          {Object.values(MARK).map((x) => <span key={x.t} className="inline-flex items-center gap-1.5"><b className={clsx("rounded px-1.5 text-xs", x.cls)}>{x.t}</b>{x.label}</span>)}
          <span className="inline-flex items-center gap-1.5"><b className="rounded bg-slate-100 px-1.5 text-xs text-slate-400">?</b>Chưa điểm danh</span>
        </div>
        {manage && (
          <ModalButton label="Thêm buổi học bù" icon={<CalendarPlus size={16} />} title="Thêm buổi học bù / buổi thêm" subtitle={cls.name} size="sm">
            <AddSessionForm classId={cls.id} defaultStart={cls.schedules[0]?.startTime} defaultEnd={cls.schedules[0]?.endTime} />
          </ModalButton>
        )}
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 420 + sessions.length * 72 }}>
            <thead className="border-b border-slate-100 text-xs">
              <tr>
                <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-500">Học viên ({enrollments.length})</th>
                {sessions.map((s) => {
                  const d = toDay(s.date);
                  const off = s.status === "CANCELLED";
                  const canOpen = canTake && !off && d <= today;
                  const head = (
                    <span className={clsx("block leading-tight", d === today && "text-brand-600")}>
                      <span className="block font-medium text-slate-400">{WEEKDAY_SHORT[weekday(d)]}</span>
                      <span className={clsx("block font-bold", off ? "text-slate-300 line-through" : d <= today ? "text-slate-800" : "text-slate-400")}>{fmtDate(d).slice(0, 5)}</span>
                    </span>
                  );
                  return (
                    <th key={s.id} className="w-[72px] px-1 py-2 text-center align-top">
                      {canOpen ? (
                        <ModalButton variant="bare" className="w-full rounded-lg px-1 py-1 hover:bg-brand-50" label={head} title={`Điểm danh ${WEEKDAY_SHORT[weekday(d)]} ${fmtDate(d)}`} subtitle={`${cls.name} · ${s.startTime}–${s.endTime}`} size="lg">
                          <ActionForm action={saveAttendance.bind(null, s.id)} submitLabel="Lưu điểm danh">
                            <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Chọn trạng thái cho từng học viên</span><AllPresentButton /></div>
                            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                              {enrollments.filter((e) => inSession(e, s.date)).map((e) => {
                                const cur = s.attendance.find((a) => a.studentId === e.studentId);
                                return (
                                  <div key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                                    <Avatar name={e.student.fullName} color={cls.color} />
                                    <span className="min-w-36 flex-1 text-sm font-semibold">{e.student.fullName}</span>
                                    <div className="flex gap-1">
                                      {Object.entries(MARK).map(([k, x]) => (
                                        <label key={k} className="cursor-pointer">
                                          <input type="radio" name={`st_${e.studentId}`} value={k} defaultChecked={cur ? cur.status === k : k === "PRESENT"} className="peer sr-only" />
                                          <span className={clsx("inline-flex h-8 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-bold text-slate-400 ring-1 ring-slate-200", PICK[k])}>{x.t}</span>
                                        </label>
                                      ))}
                                    </div>
                                    <input name={`note_${e.studentId}`} defaultValue={cur?.note ?? ""} placeholder="Ghi chú" className="input w-full py-1.5 text-xs sm:w-40" />
                                  </div>
                                );
                              })}
                            </div>
                            <Grid>
                              <Field label="Nội dung đã dạy"><input name="taughtContent" defaultValue={s.taughtContent ?? ""} className="input" /></Field>
                              <Field label="Bài tập về nhà"><input name="homework" defaultValue={s.homework ?? ""} className="input" /></Field>
                            </Grid>
                          </ActionForm>
                        </ModalButton>
                      ) : head}
                      {s.source !== "SCHEDULE" && <span className={clsx("mt-0.5 inline-block rounded px-1 text-[10px] font-semibold", s.source === "MAKEUP" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700")}>{s.source === "MAKEUP" ? "Bù" : "Thêm"}</span>}
                      {off && <span className="mt-0.5 inline-block rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500" title={s.cancelReason ?? ""}>Nghỉ</span>}
                      {manage && (
                        <div className="mt-0.5">
                          <RowMenu>
                            {off ? (
                              <ConfirmButton variant="menu" label="Khôi phục buổi" icon={<RotateCcw size={15} />} title="Khôi phục buổi học?" confirmLabel="Khôi phục" message={`Lý do nghỉ trước đó: ${s.cancelReason ?? "—"}`} action={restoreSession.bind(null, s.id)} />
                            ) : (
                              <ModalButton variant="danger-menu" label="Cho nghỉ buổi này" icon={<Ban size={15} />} title={`Cho nghỉ ${fmtDate(d)}`} subtitle={`${cls.name} · ${s.startTime}–${s.endTime}`} size="sm">
                                <CancelSessionForm sessionId={s.id} hasAttendance={s.attendance.length > 0} />
                              </ModalButton>
                            )}
                            {s.source !== "SCHEDULE" && <ConfirmButton label="Xóa buổi này" icon={<Trash2 size={15} />} title="Xóa buổi học?" message="Chỉ xóa được buổi học bù / buổi thêm chưa điểm danh." action={deleteSession.bind(null, s.id)} />}
                          </RowMenu>
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="px-2 py-3 font-semibold text-emerald-700">Có</th>
                <th className="px-2 py-3 font-semibold text-amber-700">Phép</th>
                <th className="px-3 py-3 font-semibold text-rose-700">Vắng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrollments.length === 0 && <tr><td colSpan={sessions.length + 4} className="px-4 py-8 text-center text-slate-500">Lớp chưa có học viên trong tháng này.</td></tr>}
              {enrollments.map((e) => {
                const marks = sessions.map((s) => s.attendance.find((a) => a.studentId === e.studentId));
                const n = (st: string) => marks.filter((x) => x?.status === st).length;
                return (
                  <tr key={e.id} className="hover:bg-slate-50/60">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2">
                      <div className="flex items-center gap-2.5"><Avatar name={e.student.fullName} color={cls.color} /><div><div className="font-semibold">{e.student.fullName}</div><div className="text-xs text-slate-500">{e.student.code}{e.status === "LEFT" ? " · đã nghỉ" : ""}</div></div></div>
                    </td>
                    {sessions.map((s, i) => {
                      const d = toDay(s.date);
                      const a = marks[i];
                      const enrolled = inSession(e, s.date);
                      return (
                        <td key={s.id} className={clsx("text-center", s.status === "CANCELLED" && "bg-slate-50")}>
                          {s.status === "CANCELLED" || !enrolled ? null : a ? (
                            <span title={a.note ?? MARK[a.status].label} className={clsx("inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold", MARK[a.status].cls, a.note && "ring-1 ring-current")}>{MARK[a.status].t}</span>
                          ) : d <= today ? (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-400">?</span>
                          ) : null}
                        </td>
                      );
                    })}
                    <td className="px-2 text-center font-bold text-emerald-700">{n("PRESENT")}</td>
                    <td className="px-2 text-center font-bold text-amber-700">{n("EXCUSED")}</td>
                    <td className="px-3 text-center font-bold text-rose-700">{n("ABSENT")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>{held.length} buổi học trong tháng {month.slice(5)}/{month.slice(0, 4)} ({past.length} buổi đã qua{sessions.length - held.length ? `, ${sessions.length - held.length} buổi nghỉ` : ""})</span>
          {canTake && <span>Bấm vào ngày để điểm danh · ⋮ để cho nghỉ hoặc khôi phục</span>}
        </div>
      </section>
    </>
  );
}
