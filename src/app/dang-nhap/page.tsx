import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Đăng nhập" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-acc-50 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="WorldMap EDU" className="mb-2 h-24 w-24 object-contain" />
          <h1 className="text-xl font-extrabold tracking-tight">WorldMap EDU</h1>
          <p className="mt-1 text-sm text-slate-500">Đăng nhập để tiếp tục làm việc</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
