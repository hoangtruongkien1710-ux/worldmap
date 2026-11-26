"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { useKeepValuesSubmit } from "@/components/ui/modal";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const submit = useKeepValuesSubmit(action);
  // Form gửi bằng POST qua Server Action: mật khẩu không bao giờ nằm trên URL.
  return (
    <form action={action} onSubmit={submit} method="post" className="space-y-4">
      <label className="block text-sm font-semibold">
        Tài khoản
        <input name="username" autoComplete="username" required className="input mt-1.5" placeholder="Tên đăng nhập" />
      </label>
      <label className="block text-sm font-semibold">
        Mật khẩu
        <PasswordInput name="password" autoComplete="current-password" required className="mt-1.5" placeholder="Mật khẩu" />
      </label>
      {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full py-2.5">
        <LogIn size={16} /> {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
