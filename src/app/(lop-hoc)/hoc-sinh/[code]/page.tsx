import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, GraduationCap, Phone, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadInvoices } from "@/lib/tuition/summary";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";

export const dynamic = "force-dynamic";

const ATT: Record<string, { label: string; cls: string }> = {
  PRESENT: { label: "Có mặt", cls: "bg-green-50 text-green-700" },
  EXCUSED: { label: "Nghỉ có phép", cls: "bg-amber-50 text-amber-700" },
  ABSENT: { label: "Nghỉ không phép", cls: "bg-rose-50 text-rose-700" },
};

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const user = await guardPage("student.view");
  const { code } = await params;
  const s = await db.student.findUnique({
    where: { code: decodeURIComponent(code) },
    include: {
      grade: true,
      enrollments: { include: { class: { include: { teacher: true, course: true } } }, orderBy: { joinDate: "desc" } },
      attendance: { include: { session: { include: { class: true } } }, orderBy: { session: { date: "desc" } } },
    },
  });
  if (!s) notFound();
  // Giáo viên chỉ xem được học viên trong lớp mình dạy.
  if (user.role === "TEACHER" && !s.enrollments.some((e) => e.class.teacherId === user.id)) notFound();
  const showMoney = can(user.role, "tuition.view");
  const invoices = showMoney ? await loadInvoices({ studentId: s.id }) : [];
  const att = user.role === "TEACHER" ? s.attendance.filter((a) => a.session.class.teacherId === user.id) : s.attendance;
  const count = (st: string) => att.filter((a) => a.status === st).length;
  const due = invoices.reduce((t, i) => t + i.total, 0);
  const paid = invoices.reduce((t, i) => t + i.paid, 0);

  return (
    <>
      <Link href="/hoc-sinh" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> Danh sách học viên</Link>
      <PageHeader title={s.fullName} subtitle={`${s.code} · ${s.grade?.name ?? ""}${s.school ? ` · ${s.school}` : ""}`} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-500"><Phone size={15} /> Liên hệ</div>
          <div className="font-semibold">{s.parentName ? `${s.parentName} (${s.parentRelation})` : "Học viên tự liên hệ"}</div>
          <div className="text-sm text-slate-600">{s.parentPhone}</div>
        </div>
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-500"><CalendarCheck size={15} /> Chuyên cần</div>
          <div className="text-xl font-extrabold">{att.length ? Math.round((count("PRESENT") / att.length) * 100) : 0}%</div>
          <div className="text-xs text-slate-500">Có mặt {count("PRESENT")} · có phép {count("EXCUSED")} · không phép {count("ABSENT")}</div>
        </div>
        {showMoney && (
          <div className="card p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-500"><Wallet size={15} /> Học phí</div>
            <div className={`text-xl font-extrabold ${due - paid > 0 ? "text-rose-600" : "text-emerald-700"}`}>{due - paid > 0 ? `Còn nợ ${money(due - paid)}` : "Đã đóng đủ"}</div>
            <div className="text-xs text-slate-500">Phải thu {money(due)} · đã thu {money(paid)}</div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><GraduationCap size={18} className="text-indigo-500" /> Lớp đã ghi danh</h2>
          <ul className="space-y-2.5">
            {s.enrollments.map((e) => (
              <li key={e.id} className="rounded-xl border border-slate-100 p-3" style={{ borderLeft: `4px solid ${e.class.color}` }}>
                <div className="flex items-center justify-between gap-2">
                  <b>{e.class.name}</b>
                  <span className={`badge ${e.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{e.status === "ACTIVE" ? "Đang học" : "Đã kết thúc"}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  GV {e.class.teacher?.fullName ?? "—"} · vào học {fmtDate(e.joinDate)}{e.leaveDate ? ` · kết thúc ${fmtDate(e.leaveDate)}` : ""}{e.percentDiscount ? ` · ưu đãi ${e.percentDiscount}%` : ""}
                </div>
              </li>
            ))}
          </ul>

          {showMoney && invoices.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 text-lg font-bold">Học phí và các lần đóng</h2>
              <ul className="space-y-2.5 text-sm">
                {invoices.map((i) => (
                  <li key={i.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex justify-between gap-2"><span>{i.items.map((it) => it.className).join(", ")}</span><b>{money(i.total)}</b></div>
                    {i.payments.map((p) => (
                      <div key={p.id} className="mt-1 flex justify-between text-xs text-slate-600">
                        <span>{fmtDate(p.paidAt)} · {p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}{p.note ? ` · ${p.note}` : ""}</span>
                        <span className="text-emerald-700">+{money(p.amount)}</span>
                      </div>
                    ))}
                    {i.remain > 0 && <div className="mt-1 text-right text-xs font-semibold text-rose-600">Còn nợ {money(i.remain)}</div>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Điểm danh gần đây</h2>
          {att.length === 0 && <p className="text-sm text-slate-500">Chưa có buổi điểm danh.</p>}
          <div className="divide-y divide-slate-100">
            {att.slice(0, 20).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-slate-500">{fmtDate(a.session.date)}</span>
                <span className="min-w-0 flex-1 truncate">{a.session.class.name} · {a.session.startTime}</span>
                <span className={`badge ${ATT[a.status].cls}`}>{ATT[a.status].label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
