import clsx from "clsx";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Banknote, ChevronLeft, ChevronRight, FileSpreadsheet, History, XCircle } from "lucide-react";
import { ActionForm, ConfirmButton, Field, Grid, ModalButton } from "@/components/ui/modal";
import { PayMethod } from "@/components/classes/client";
import { CollectFields } from "./client";
import { cancelPayment, collectFromSheet } from "@/lib/actions/payments";
import { fmtDate, todayVN } from "@/lib/dates";
import { money } from "@/lib/money";
import { monthShort, type FeeSheet } from "@/lib/tuition/month";

/** Thẻ số liệu có vòng tròn phần trăm như ảnh mẫu. */
export function RingStat({ icon, label, value, hint, pct, ring, color }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; hint?: React.ReactNode; pct: number; ring?: string; color: string;
}) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600">{icon}{label}</div>
        <div className="mt-1 whitespace-nowrap text-xl font-extrabold tracking-tight 2xl:text-2xl">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
      </div>
      <svg viewBox="0 0 76 76" className="h-16 w-16 shrink-0 2xl:h-[76px] 2xl:w-[76px]" aria-hidden>
        <circle cx="38" cy="38" r={r} fill="none" stroke="#eef2f7" strokeWidth="7" />
        <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 38 38)" />
        <text x="38" y="42" textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>{ring ?? `${Math.round(p)}%`}</text>
      </svg>
    </div>
  );
}

export function SheetStatus({ s }: { s: FeeSheet["status"] }) {
  return s === "paid" ? <span className="badge whitespace-nowrap bg-green-50 text-green-700">● Đã thu đủ</span>
    : s === "part" ? <span className="badge whitespace-nowrap bg-amber-50 text-amber-700">● Thu một phần</span>
    : <span className="badge whitespace-nowrap bg-rose-50 text-rose-700">● Chưa thu</span>;
}

type Account = { id: string; name: string; kind: string };

/** Nút “Thu” mở popup thu tiền cho một phiếu (mỗi lần thu lưu riêng). */
export function CollectButton({ sheet, accounts, label, className }: { sheet: FeeSheet; accounts: Account[]; label?: React.ReactNode; className?: string }) {
  const items = sheet.items.filter((i) => i.remain > 0 && i.enrollmentId).map((i) => ({ enrollmentId: i.enrollmentId!, label: i.className, remain: i.remain }));
  if (!items.length) return null;
  const active = sheet.payments.filter((p) => !p.voidedAt);
  return (
    <ModalButton variant="bare" className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-100", className)}
      label={label ?? "Thu"} icon={<Banknote size={15} />} title={`Thu học phí · ${sheet.student.fullName}`} subtitle={`${sheet.student.code} · phiếu ${monthShort(sheet.month)}`} size="md">
      <ActionForm action={collectFromSheet} submitLabel="Lưu lần thu">
        <input type="hidden" name="idempotencyKey" value={randomUUID()} />
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-sm">
          <div><div className="text-xs text-slate-500">Tổng phiếu</div><b>{money(sheet.total)}</b></div>
          <div><div className="text-xs text-slate-500">Đã thu ({active.length} lần)</div><b className="text-emerald-700">{money(sheet.paid)}</b></div>
          <div><div className="text-xs text-slate-500">Còn lại</div><b className="text-rose-600">{money(sheet.remain)}</b></div>
        </div>
        <ul className="space-y-1 text-xs text-slate-600">
          {sheet.items.map((i) => <li key={i.key} className="flex justify-between gap-2"><span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: i.color }} />{i.className} · {i.how}</span><b className={i.remain ? "text-rose-600" : "text-emerald-700"}>{i.remain ? `còn ${money(i.remain)}` : "đủ"}</b></li>)}
        </ul>
        <CollectFields items={items} />
        <PayMethod accounts={accounts} />
        <Grid>
          <Field label="Ngày thu"><input type="date" name="paidAt" defaultValue={todayVN()} required className="input" /></Field>
          <Field label="Mã giao dịch ngân hàng"><input name="txnRef" className="input" placeholder="Không bắt buộc" /></Field>
        </Grid>
        <Field label="Ghi chú"><input name="note" className="input" defaultValue={active.length ? `Đợt ${active.length + 1}` : ""} placeholder="VD: Đợt 1" /></Field>
      </ActionForm>
    </ModalButton>
  );
}

/** Lịch sử các lần thu của phiếu, hủy được từng lần. */
export function HistoryButton({ sheet, canCollect }: { sheet: FeeSheet; canCollect: boolean }) {
  return (
    <ModalButton variant="bare" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" label={<History size={16} />} title={`Lịch sử thu · ${sheet.student.fullName}`} subtitle={`Phiếu ${monthShort(sheet.month)} · ${money(sheet.total)}`} size="md">
      {sheet.payments.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">Chưa có lần thu nào.</p> : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
          {sheet.payments.map((p, i) => (
            <li key={p.id} className={clsx("flex items-center gap-3 px-3 py-2.5", p.voidedAt && "bg-slate-50 text-slate-400")}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className={clsx("font-semibold", p.voidedAt && "line-through")}>{money(p.amount)}</div>
                <div className="text-xs text-slate-500">{fmtDate(p.paidAt)} · {p.className} · {p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}{p.txnRef ? ` · ${p.txnRef}` : ""}{p.note ? ` · ${p.note}` : ""}{p.voidedAt ? " · ĐÃ HỦY" : ""}</div>
              </div>
              {canCollect && !p.voidedAt && (
                <ConfirmButton variant="btn" label="Hủy" icon={<XCircle size={14} />} title="Hủy lần thu này?" confirmLabel="Hủy lần thu"
                  message={<>Lần thu <b>{money(p.amount)}</b> ngày {fmtDate(p.paidAt)} sẽ bị hủy, phiếu thu trong sổ quỹ / ngân hàng cũng bị hủy.</>} action={cancelPayment.bind(null, p.id)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </ModalButton>
  );
}

/** Chọn tháng ◀ Tháng 11/2026 ▶ như ảnh mẫu. */
export function MonthNav({ month, href }: { month: string; href: (m: string) => string }) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  return (
    <div className="card flex items-center gap-1 px-1.5 py-1">
      <Link href={href(shift(-1))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Tháng trước"><ChevronLeft size={18} /></Link>
      <div className="min-w-[150px] text-center leading-tight">
        <div className="font-bold">Tháng {m}/{y}</div>
        <div className="text-xs text-slate-500">01/{String(m).padStart(2, "0")}/{y} – {last}/{String(m).padStart(2, "0")}/{y}</div>
      </div>
      <Link href={href(shift(1))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Tháng sau"><ChevronRight size={18} /></Link>
    </div>
  );
}

/** ▲ / ▼ phần trăm so với kỳ trước. `good` = tăng là tốt. */
export function Trend({ now, prev, good = true, className }: { now: number; prev: number; good?: boolean; className?: string }) {
  if (!prev) return null;
  const pct = ((now - prev) / prev) * 100;
  if (Math.abs(pct) < 0.05) return <span className={clsx("text-xs font-semibold text-slate-400", className)}>= 0%</span>;
  const up = pct > 0;
  return <span className={clsx("whitespace-nowrap text-xs font-bold", up === good ? "text-emerald-600" : "text-rose-600", className)}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>;
}

export function ExcelLink({ href }: { href: string }) {
  return <a href={href} className="btn print:hidden"><FileSpreadsheet size={16} />Xuất Excel</a>;
}
