"use client";

import { useState } from "react";
import { CheckCheck } from "lucide-react";

/** Nút “Tất cả có mặt” trong popup điểm danh. */
export function AllPresentButton() {
  return (
    <button
      type="button"
      className="btn py-1.5 text-xs"
      onClick={(e) => {
        const form = (e.currentTarget as HTMLElement).closest("form");
        form?.querySelectorAll<HTMLInputElement>('input[type=radio][value="PRESENT"]').forEach((r) => (r.checked = true));
      }}
    >
      <CheckCheck size={15} /> Tất cả có mặt
    </button>
  );
}

/** Chọn hình thức thu: tiền mặt → quỹ tiền mặt, chuyển khoản → tài khoản ngân hàng. */
export function PayMethod({ accounts }: { accounts: { id: string; name: string; kind: string }[] }) {
  const cash = accounts.filter((a) => a.kind === "CASH");
  const bank = accounts.filter((a) => a.kind === "BANK");
  const [method, setMethod] = useState<"TRANSFER" | "CASH">("TRANSFER");
  const list = method === "CASH" ? cash : bank;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Hình thức</span>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(["TRANSFER", "CASH"] as const).map((m) => (
            <label key={m} className={`cursor-pointer rounded-lg px-3 py-1.5 text-center text-sm font-semibold ${method === m ? "bg-white shadow-sm" : "text-slate-500"}`}>
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              {m === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
            </label>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">{method === "CASH" ? "Nhập vào quỹ" : "Tài khoản nhận"}</span>
        <select key={method} name="accountId" className="input" defaultValue={list[0]?.id}>
          {list.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
    </div>
  );
}

/** Ô số tiền có nút điền nhanh số còn lại. */
export function AmountInput({ remain }: { remain: number }) {
  const [v, setV] = useState(remain > 0 ? String(remain) : "");
  const fmt = (s: string) => (s ? Number(s.replace(/\D/g, "")).toLocaleString("vi-VN") : "");
  return (
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
  );
}
