import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";

const schema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(80),
  password: z.string().min(6).max(200),
});

// Chống dò mật khẩu đơn giản trong bộ nhớ: tối đa 5 lần sai / 15 phút cho mỗi tài khoản.
const failures = new Map<string, { count: number; until: number }>();

class LockedError extends CredentialsSignin {
  code = "locked";
}
class InactiveError extends CredentialsSignin {
  code = "inactive";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = schema.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;
        const f = failures.get(username);
        if (f && f.count >= 5 && f.until > Date.now()) throw new LockedError();
        const user = await db.user.findUnique({ where: { username } });
        const passOk = !!user && (await bcrypt.compare(password, user.passwordHash));
        // Chỉ báo "bị khóa" khi mật khẩu đúng, để người lạ không dò được tài khoản nào tồn tại.
        if (passOk && !user.active) throw new InactiveError();
        const ok = passOk && user.active;
        if (!ok) {
          const next = { count: (f && f.until > Date.now() ? f.count : 0) + 1, until: Date.now() + 15 * 60_000 };
          failures.set(username, next);
          return null;
        }
        failures.delete(username);
        return { id: user!.id, role: user!.role, fullName: user!.fullName, username: user!.username };
      },
    }),
  ],
});
