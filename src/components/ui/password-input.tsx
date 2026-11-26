"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import clsx from "clsx";

/** Ô mật khẩu có nút con mắt để hiện / ẩn chữ đang nhập. */
export function PasswordInput({ className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <span className={clsx("relative block", className)}>
      <input {...props} type={show ? "text" : "password"} className="input w-full" style={{ paddingRight: 42 }} />
      <button type="button" onClick={() => setShow((v) => !v)} tabIndex={-1}
        aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} title={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  );
}
