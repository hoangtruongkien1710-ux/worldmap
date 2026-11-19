import Link from "next/link";
import { Phones } from "@/components/students/phones";
import clsx from "clsx";
import { randomUUID } from "node:crypto";
import { Banknote, CircleAlert, CircleCheck, History, Lock, Phone, Search, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { fmtDate, todayVN } from "@/lib/dates";
import { money } from "@/lib/money";
import { ActionForm, ConfirmButton, Field, Grid, ModalButton } from "@/components/ui/modal";
import { AmountInput, PayMethod } from "@/components/classes/client";
import { cancelPayment, collectPayment } from "@/lib/actions/payments";
import type { classTuition } from "@/lib/tuition/summary";
import { Avatar } from "./students-tab";

type Row = Awaited<ReturnType<typeof classTuition>>[number];

export async function TuitionTab({ cls, rows: all, sp, debtOnly, canCollect }: {
  cls: { id: string; code: string; name: string; color: string; feeMode: string; unitPrice: number; totalSessions: number | null };
  rows: Row[]; sp: { q?: string; loc?: string }; debtOnly: boolean; canCollect: boolean;
}) {
  const today = todayVN();
  const [accounts, attendance] = await Promise.all([
    db.cashAccount.findMany({ where: { active: true }, orderBy: [{ kind: "desc" }, { code: "desc" }] }),
    db.attendance.groupBy({ by: ["studentId", "status"], where: { session: { classId: cls.id } }, _count: true }),
  ]);
  const att = (sid: string, st: string) => attendance.find((a) => a.studentId === sid && a.status === st)?._count ?? 0;
  const rows = all.filter((r) => r.enrollment.status === "ACTIVE" || r.due > 0);
  const due = rows.reduce((s, r) => s + r.due, 0);
  const paid = rows.reduce((s, r) => s + r.paid, 0);
  const done = rows.filter((r) => r.remain === 0 && r.due > 0).length;

  const filter = debtOnly ? "debt" : sp.loc === "chua-thu" ? "debt" : sp.loc === "da-thu" ? "paid" : "all";
  const q = sp.q?.trim().toLowerCase();
  const shown = rows
    .filter((r) => (filter === "debt" ? r.remain > 0 : filter === "paid" ? r.remain === 0 : true))
    .filter((r) => !q || r.student.fullName.toLowerCase().includes(q) || r.student.code.toLowerCase().includes(q))
    .sort((a, b) => (debtOnly ? b.remain - a.remain : 0));
  const base = `/lop-hoc/${cls.code}?tab=${debtOnly ? "cong-no" : "hoc-phi"}`;
  const unit = cls.feeMode === "PER_SESSION" ? "buổi" : "khóa";

  return (
    <>
      {!debtOnly && (
        <section className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-blue-800 p-6 text-white shadow-lg shadow-brand-600/20">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
          <div className="relative">
            <div className="text-sm text-blue-100">{rows.length} học viên · {cls.feeMode === "PER_SESSION" ? "Tính theo số buổi đã học" : `Trọn khóa${cls.totalSessions ? ` ${cls.totalSessions} buổi` : ""}`} · {money(cls.unitPrice)}/{unit}</div>
            <div className="mt-1 text-sm text-blue-100">Tổng học phí phải thu</div>
            <div className="text-4xl font-extrabold tracking-tight">{money(due)}</div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div><div className="text-2xl font-extrabold">{done}/{rows.length}</div><div className="text-xs text-blue-100">HV đã đóng đủ</div></div>
              <div><div className="text-2xl font-extrabold">{money(paid)}</div><div className="text-xs text-blue-100">Tổng đã thu</div></div>
              <div><div className="text-2xl font-extrabold">{money(due - paid)}</div><div className="text-xs text-blue-100">Còn thiếu</div></div>
            </div>
          </div>
        </section>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!debtOnly && ([["all", undefined, "Tất cả", rows.length], ["debt", "chua-thu", "Chưa thu đủ", rows.filter((r) => r.remain > 0).length], ["paid", "da-thu", "Đã thu đủ", rows.filter((r) => r.remain === 0).length]] as const).map(([k, loc, label, n]) => (
          <Link key={k} href={`${base}${loc ? `&loc=${loc}` : ""}`} className={clsx("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold ring-1", filter === k ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-slate-600 ring-slate-200")}>
            {label}<span className={clsx("rounded-md px-1.5 text-xs", filter === k ? "bg-white/20" : "bg-slate-100")}>{n}</span>
          </Link>
        ))}
        {debtOnly && <div className="text-sm text-slate-600"><b className="text-rose-600">{shown.length}</b> học viên còn nợ · tổng <b className="text-rose-600">{money(shown.reduce((s, r) => s + r.remain, 0))}</b></div>}
        <form action={`/lop-hoc/${cls.code}`} className="relative min-w-56 flex-1">
          <input type="hidden" name="tab" value={debtOnly ? "cong-no" : "hoc-phi"} />
          {sp.loc && !debtOnly && <input type="hidden" name="loc" value={sp.loc} />}
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={sp.q} placeholder="Tìm học viên…" className="input" style={{ paddingLeft: 36 }} />
        </form>
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Học viên</th>
                {debtOnly ? <th className="px-3 py-3">Liên hệ</th> : <th className="px-3 py-3">Buổi · Có · Phép · Vắng</th>}
                <th className="px-3 py-3">Cách tính</th><th className="px-3 py-3 text-right">Phải thu</th><th className="px-3 py-3 text-right">Đã thu</th>
                <th className="px-3 py-3 text-right">Còn lại</th><th className="px-3 py-3">Trạng thái</th><th className="px-3 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">{debtOnly ? "Không có học viên nào còn nợ." : "Không có học viên."}</td></tr>}
              {shown.map((r) => {
                const s = r.student;
                const active = r.payments.filter((p) => !p.voidedAt);
                const status = r.due === 0 ? "none" : r.remain === 0 ? "paid" : r.paid > 0 ? "part" : "unpaid";
                const lastPay = active[active.length - 1];
                return (
                  <tr key={r.enrollment.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3"><Avatar name={s.fullName} color={cls.color} /><div><Link href={`/hoc-sinh/${s.code}`} className="font-semibold hover:underline">{s.fullName}</Link><div className="text-xs text-slate-500">{s.code}{r.enrollment.status === "LEFT" ? " · đã nghỉ" : ""}</div></div></div>
                    </td>
                    {debtOnly ? (
                      <td className="px-3 py-2.5">
                        <div>{s.parentName ?? "Học viên"}</div>
                        <Phones s={s} />
                        {lastPay && <div className="text-xs text-slate-400">Đóng gần nhất {fmtDate(lastPay.paidAt)}</div>}
                      </td>
                    ) : (
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1 text-xs font-bold">
                          <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-blue-700" title="Buổi đã học">{r.held}</span>
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-700" title="Có mặt">{att(s.id, "PRESENT")}</span>
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-700" title="Vắng phép">{att(s.id, "EXCUSED")}</span>
                          <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-rose-700" title="Vắng">{att(s.id, "ABSENT")}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-[13px] text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        {r.locked && <Lock size={12} className="text-slate-400" aria-label="Đã chốt" />}
                        {cls.feeMode === "PER_SESSION" ? `${money(cls.unitPrice)} × ${r.held} buổi` : `${money(r.gross)}/khóa`}
                        {r.discount > 0 && <span className="text-emerald-700"> − {money(r.discount)} ({r.enrollment.percentDiscount}%)</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold">{money(r.due)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      {r.paid ? <span className="font-semibold text-emerald-700">{money(r.paid)}</span> : "—"}
                      {active.length > 1 && <div className="text-xs text-slate-400">{active.length} lần thu</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-rose-600">{r.remain ? money(r.remain) : <span className="font-normal text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5">
                      {status === "paid" && <span className="badge gap-1 bg-green-50 text-green-700"><CircleCheck size={13} />Đã thu đủ</span>}
                      {status === "part" && <span className="badge gap-1 bg-amber-50 text-amber-700"><CircleAlert size={13} />Thu một phần</span>}
                      {status === "unpaid" && <span className="badge gap-1 bg-rose-50 text-rose-700"><CircleAlert size={13} />Chưa thu</span>}
                      {status === "none" && <span className="badge bg-slate-100 text-slate-500">Chưa phát sinh</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canCollect && r.remain > 0 && (
                          <ModalButton variant="bare" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-100" label="Thu" icon={<Banknote size={15} />}
                            title={`Thu học phí · ${s.fullName}`} subtitle={`${s.code} · ${cls.name}`} size="md">
                            <ActionForm action={collectPayment.bind(null, r.enrollment.id)} submitLabel="Lưu lần thu">
                              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-sm">
                                <div><div className="text-xs text-slate-500">Phải thu</div><b>{money(r.due)}</b></div>
                                <div><div className="text-xs text-slate-500">Đã thu ({active.length} lần)</div><b className="text-emerald-700">{money(r.paid)}</b></div>
                                <div><div className="text-xs text-slate-500">Còn lại</div><b className="text-rose-600">{money(r.remain)}</b></div>
                              </div>
                              {active.length > 0 && (
                                <ul className="space-y-1 text-xs text-slate-600">
                                  {active.map((p, i) => <li key={p.id} className="flex justify-between"><span>Lần {i + 1} · {fmtDate(p.paidAt)} · {p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}{p.note ? ` · ${p.note}` : ""}</span><b>{money(p.amount)}</b></li>)}
                                </ul>
                              )}
                              <AmountInput remain={r.remain} />
                              <PayMethod accounts={accounts} />
                              <Grid>
                                <Field label="Ngày thu"><input type="date" name="paidAt" defaultValue={today} required className="input" /></Field>
                                <Field label="Mã giao dịch ngân hàng"><input name="txnRef" className="input" placeholder="Không bắt buộc" /></Field>
                              </Grid>
                              <Field label="Ghi chú"><input name="note" className="input" placeholder={`VD: Đợt ${active.length + 1}`} defaultValue={active.length ? `Đợt ${active.length + 1}` : ""} /></Field>
                              {!r.locked && <p className="text-xs text-amber-600">Lần thu đầu sẽ chốt học phí {money(r.due)} cho học viên này.</p>}
                            </ActionForm>
                          </ModalButton>
                        )}
                        <ModalButton variant="bare" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" label={<History size={16} />} title={`Lịch sử thu · ${s.fullName}`} subtitle={`${cls.name} · phải thu ${money(r.due)}`} size="md">
                          {r.payments.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">Chưa có lần thu nào.</p> : (
                            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                              {r.payments.map((p, i) => (
                                <li key={p.id} className={clsx("flex items-center gap-3 px-3 py-2.5", p.voidedAt && "bg-slate-50 text-slate-400")}>
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span>
                                  <div className="flex-1">
                                    <div className={clsx("font-semibold", p.voidedAt && "line-through")}>{money(p.amount)}</div>
                                    <div className="text-xs text-slate-500">{fmtDate(p.paidAt)} · {p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}{p.txnRef ? ` · ${p.txnRef}` : ""}{p.note ? ` · ${p.note}` : ""}{p.voidedAt ? " · ĐÃ HỦY" : ""}</div>
                                  </div>
                                  {canCollect && !p.voidedAt && (
                                    <ConfirmButton variant="btn" label="Hủy" icon={<XCircle size={14} />} title="Hủy lần thu này?" confirmLabel="Hủy lần thu"
                                      message={<>Lần thu <b>{money(p.amount)}</b> ngày {fmtDate(p.paidAt)} sẽ bị hủy. Phiếu thu trong sổ quỹ / ngân hàng cũng bị hủy và ghi bút toán đảo.</>}
                                      action={cancelPayment.bind(null, p.id)} />
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </ModalButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">Hiển thị {shown.length} / {rows.length} học viên · <Lock size={12} className="inline" /> đã chốt học phí</div>
      </section>
    </>
  );
}
