"use client";

import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";

const root = () => document.documentElement;

/** Bật/tắt chế độ "giấy in": ẩn menu, nút, bộ lọc; bỏ thanh cuộn để bảng in đủ cột. */
export function usePrintMode() {
  useEffect(() => {
    const on = () => { root().classList.add("pv"); root().style.setProperty("--printed", `"WorldMap EDU · In ngày ${new Date().toLocaleDateString("vi-VN")}"`); };
    const off = () => { if (!root().classList.contains("pv-preview")) root().classList.remove("pv"); };
    window.addEventListener("beforeprint", on);
    window.addEventListener("afterprint", off);
    return () => { window.removeEventListener("beforeprint", on); window.removeEventListener("afterprint", off); };
  }, []);
}

/** Nút In: mở màn hình xem trước (khổ giấy ngang/dọc) rồi mới in. */
export function PrintButton() {
  const [open, setOpen] = useState(false);
  const [orient, setOrient] = useState<"landscape" | "portrait">("landscape");
  useEffect(() => {
    const r = root();
    r.classList.toggle("pv", open);
    r.classList.toggle("pv-preview", open);
    r.dataset.orient = orient;
    if (open) r.style.setProperty("--printed", `"WorldMap EDU · In ngày ${new Date().toLocaleDateString("vi-VN")}"`);
    let st = document.getElementById("pv-page");
    if (!st) { st = document.createElement("style"); st.id = "pv-page"; document.head.appendChild(st); }
    st.textContent = `@page { size: A4 ${orient}; margin: 10mm; }`;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); r.classList.remove("pv", "pv-preview"); };
  }, [open, orient]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn print:hidden"><Printer size={16} />In</button>
      {open && (
        <div className="pv-toolbar fixed inset-x-0 top-0 z-50 flex flex-wrap items-center gap-2 bg-slate-800 px-4 py-2.5 text-sm text-white shadow-lg">
          <b className="mr-2">Xem trước khi in</b>
          <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-white/30">
            {(["landscape", "portrait"] as const).map((o) => (
              <button key={o} type="button" onClick={() => setOrient(o)} className={`px-3 py-1.5 font-semibold ${orient === o ? "bg-white text-slate-800" : "hover:bg-white/10"}`}>{o === "landscape" ? "Giấy ngang" : "Giấy dọc"}</button>
            ))}
          </div>
          <span className="hidden text-xs text-slate-300 sm:inline">Trong hộp thoại in có thể chọn “Lưu dạng PDF”.</span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-1.5 font-bold text-white hover:bg-emerald-600"><Printer size={15} />In</button>
            <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold ring-1 ring-white/30 hover:bg-white/10"><X size={15} />Đóng</button>
          </div>
        </div>
      )}
    </>
  );
}
