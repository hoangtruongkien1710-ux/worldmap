"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import clsx from "clsx";
import { useCloseModal } from "@/components/ui/modal";
import { importPayroll, previewPayroll, type PayrollPreview } from "@/lib/actions/payroll";

const n = (v: number) => v.toLocaleString("vi-VN");

/** Nhập bảng lương từ Excel: chọn file → xem trước (chưa ghi gì) → xác nhận. */
export function PayrollImportForm() {
  const close = useCloseModal();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState("");
  const [prev, setPrev] = useState<PayrollPreview | null>(null);
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();

  const fd = () => { const f = new FormData(); if (file) f.set("file", file); if (month) f.set("month", month); return f; };
  const preview = () => start(async () => {
    setErr(""); setPrev(null);
    if (!file) { setErr("Chọn file Excel (.xlsx) bảng lương."); return; }
    const r = await previewPayroll(fd());
    if (r.ok) setPrev(r); else setErr(r.error);
  });
  const confirm = () => start(async () => {
    const r = await importPayroll({ ok: false }, fd());
    if (r.ok) { router.refresh(); close(); } else setErr(r.error ?? "Không nhập được.");
  });

  const blocked = !!prev && prev.ok && (prev.blocking > 0 || prev.rows.length === 0 || prev.existing === "LOCKED" || prev.existing === "PAID");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">File bảng lương (.xlsx)</span>
          <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPrev(null); setErr(""); }} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Tháng (nếu cần)</span>
          <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPrev(null); }} className="input" />
        </label>
      </div>
      <p className="text-xs text-slate-500">Dùng đúng bố cục mẫu: dòng “Bảng lương tháng MM/YYYY”, dòng tiêu đề có cột “Họ tên”, kết thúc bằng dòng “TỔNG CỘNG”. <a className="font-semibold text-brand-600 hover:underline" href="/ke-toan/tien-luong/mau">Tải file mẫu</a></p>
      {err && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

      {prev?.ok && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FileSpreadsheet size={16} className="text-slate-400" />
            <b>{prev.fileName}</b> · tháng <b>{prev.month.slice(5)}/{prev.month.slice(0, 4)}</b> · {prev.rows.length} nhân sự
            {prev.rows.some((r) => r.newCode) && <span className="badge bg-sky-50 text-sky-700">{prev.rows.filter((r) => r.newCode).length} nhân sự mới</span>}
          </div>
          {prev.existing === "IMPORTED" && <div className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Tháng này đã có bảng lương chờ chốt. Nhập tiếp sẽ <b>thay toàn bộ</b> bảng cũ.</div>}
          {prev.existing === "LOCKED" && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">Bảng lương tháng này đã chốt. Hãy “Hủy chốt” rồi nhập lại.</div>}
          {prev.existing === "PAID" && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">Tháng này đã trả lương, không nhập lại được.</div>}
          {prev.warnings.map((w, i) => <div key={i} className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{w}</div>)}
          <div className="max-h-[40vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="sticky top-0 bg-slate-50 text-left"><tr>
                <th className="px-2 py-2">Dòng</th><th className="px-2 py-2">Họ tên</th><th className="px-2 py-2">Nhân sự</th>
                <th className="px-2 py-2 text-right">Tổng lương</th><th className="px-2 py-2 text-right">Thực lĩnh</th><th className="px-2 py-2">Kiểm tra</th>
              </tr></thead>
              <tbody className="[&>tr>td]:border-t [&>tr>td]:border-slate-100">
                {prev.rows.map((r) => (
                  <tr key={r.line} className={clsx(r.errors.length && "bg-rose-50/60")}>
                    <td className="px-2 py-1.5 text-slate-400">{r.line}</td>
                    <td className="px-2 py-1.5"><div className="font-medium">{r.name || "—"}</div><div className="text-slate-500">{r.position}</div></td>
                    <td className="px-2 py-1.5">{r.match ? <span className="text-slate-600">{r.match.code}</span> : r.newCode ? <span className="font-semibold text-sky-700">Mới · {r.newCode}</span> : "—"}</td>
                    <td className="px-2 py-1.5 text-right">{n(r.gross)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{r.netFile === null ? "—" : n(r.netFile)}</td>
                    <td className="px-2 py-1.5">
                      {r.errors.map((e, i) => <div key={i} className="font-semibold text-rose-600">{e}</div>)}
                      {r.warnings.map((e, i) => <div key={i} className="text-amber-700">{e}</div>)}
                      {!r.errors.length && !r.warnings.length && <CheckCircle2 size={14} className="text-emerald-600" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {prev.blocking > 0 && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">Có {prev.blocking} dòng lỗi (tô đỏ). Sửa file rồi chọn lại.</div>}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" className="btn" onClick={close}>Hủy</button>
        <button type="button" className="btn" disabled={busy || !file} onClick={preview}><Upload size={15} />{busy && !prev ? "Đang đọc…" : "Xem trước"}</button>
        <button type="button" className="btn btn-primary" disabled={busy || !prev?.ok || blocked} onClick={confirm}>{busy && prev ? "Đang nhập…" : "Nhập bảng lương"}</button>
      </div>
    </div>
  );
}
