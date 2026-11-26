"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code;
      if (code === "inactive") return { error: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên." };
      if (code === "locked") return { error: "Sai mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút." };
      return { error: "Tên đăng nhập hoặc mật khẩu không đúng." };
    }
    throw err; // để Next.js xử lý chuyển trang sau khi đăng nhập thành công
  }
}
