import type { NextAuthConfig } from "next-auth";
import { can, type Role } from "@/lib/auth/permissions";

// Phần cấu hình chạy được ở Edge (middleware): không đụng database ở đây.
export const authConfig = {
  pages: { signIn: "/dang-nhap" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/dang-nhap")) return true;
      const role = auth?.user?.role as Role | undefined;
      if (!auth?.user) return false; // chuyển về trang đăng nhập
      if (pathname.startsWith("/ke-toan") && !can(role, "workspace.accounting")) {
        return Response.redirect(new URL("/?loi=khong-co-quyen", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = user.role;
        token.fullName = user.fullName;
        token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as Role;
      session.user.fullName = token.fullName as string;
      session.user.username = token.username as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
