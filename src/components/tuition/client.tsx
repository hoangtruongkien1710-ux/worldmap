"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

type Item = { enrollmentId: string; label: string; remain: number };

/** Chọn lớp cần thu (phiếu gộp nhiều lớp) + ô số tiền có nút điền nhanh. */
export function CollectFields({ items }: { items: Item[] }) {
  const [id, setId] = useState(items[0]?.enrollmentId ?? "");
  const remain = items.find((i) => i.enrollmentId === id)?.remain ?? 0;
  const [v, setV] = useState(String(remain));
  const fmt = (s: string) => (s ? Number(s.replace(/\D/g, "")).toLocaleString("vi-VN") : "");
  return (
    <>
      {items.length > 1 ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Thu cho lớp</span>
          <select name="enrollmentId" value={id} onChange={(e) => { setId(e.target.value); setV(String(items.find((i) => i.enrollmentId === e.target.value)?.remain ?? "")); }} className="input">
            {items.map((i) => <option key={i.enrollmentId} value={i.enrollmentId}>{i.label} · còn {i.remain.toLocaleString("vi-VN")}đ</option>)}
          </select>
        </label>
      ) : <input type="hidden" name="enrollmentId" value={id} />}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Số tiền thu lần này (đ)</span>
        <input name="amount" inputMode="numeric" value={fmt(v)} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} className="input text-lg font-bold" required />
        {remain > 0 && (
          <span className="mt-1 flex flex-wrap gap-1.5 text-xs">
            {[remain, Math.round(remain / 2 / 100_000) * 100_000].filter((x, i, a) => x > 0 && a.indexOf(x) === i).map((x) => (
              <button key={x} type="button" onClick={() => setV(String(x))} className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-200">
                {x === remain ? "Thu đủ" : "Thu một nửa"} {x.toLocaleString("vi-VN")}đ
              </button>
            ))}
          </span>
        )}
      </label>
    </>
  );
}

/** Gửi nhắc học phí: chia sẻ qua Zalo/Messenger trên điện thoại, máy tính thì chép vào bộ nhớ. */
export function ShareReminder({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" title="Gửi nhắc học phí" aria-label="Gửi nhắc học phí"
      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
      onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ text });
          else { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); }
        } catch { /* người dùng hủy chia sẻ */ }
      }}>
      {done ? <span className="text-xs font-semibold text-emerald-600">Đã chép</span> : <Share2 size={16} />}
    </button>
  );
}
