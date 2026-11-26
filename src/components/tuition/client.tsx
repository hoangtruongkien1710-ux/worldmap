"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { AmountInput } from "@/components/classes/client";

type Item = { enrollmentId: string; label: string; remain: number };

/** Chọn lớp cần thu (phiếu gộp nhiều lớp) + ô số tiền có nút điền nhanh. */
export function CollectFields({ items }: { items: Item[] }) {
  const [id, setId] = useState(items[0]?.enrollmentId ?? "");
  const remain = items.find((i) => i.enrollmentId === id)?.remain ?? 0;
  return (
    <>
      {items.length > 1 ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Thu cho lớp</span>
          <select name="enrollmentId" value={id} onChange={(e) => setId(e.target.value)} className="input">
            {items.map((i) => <option key={i.enrollmentId} value={i.enrollmentId}>{i.label} · còn {i.remain.toLocaleString("vi-VN")}đ</option>)}
          </select>
        </label>
      ) : <input type="hidden" name="enrollmentId" value={id} />}
      <AmountInput key={id} remain={remain} />
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
