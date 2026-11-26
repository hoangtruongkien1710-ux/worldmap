"use client";

import { useState } from "react";
import clsx from "clsx";

const fmt = (s: string) => (s ? Number(s).toLocaleString("vi-VN") : "");

/** Ô nhập tiền: tự thêm dấu chấm, chỉ nhận số không âm, cảnh báo ngay khi gõ dấu trừ / chữ. */
export function MoneyInput({ name, defaultValue, required, placeholder, className, label = "Số tiền" }: {
  name: string; defaultValue?: number | string | null; required?: boolean; placeholder?: string; className?: string; label?: string;
}) {
  const [v, setV] = useState(defaultValue === null || defaultValue === undefined || defaultValue === "" ? "" : String(defaultValue).replace(/\D/g, ""));
  const [warn, setWarn] = useState("");
  const change = (raw: string) => {
    const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
    // Cảnh báo giữ lại tới khi xóa trắng ô, để người nhập kịp thấy.
    setWarn((prev) => (raw.includes("-") ? `${label} không được âm, đã bỏ dấu trừ.` : /[^\d.\s,đ-]/.test(raw) ? `${label} chỉ gồm chữ số.` : digits ? prev : ""));
    setV(digits);
  };
  return (
    <>
      <input name={name} inputMode="numeric" autoComplete="off" value={fmt(v)} onChange={(e) => change(e.target.value)} required={required}
        placeholder={placeholder} aria-invalid={warn ? true : undefined} className={clsx("input", className)} />
      {warn && <span className="mt-1 block text-xs font-semibold text-rose-600">{warn}</span>}
    </>
  );
}
