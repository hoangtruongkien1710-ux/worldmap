import type { Role } from "@/lib/auth/permissions";
import "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    fullName: string;
    username: string;
  }
  interface Session {
    user: { id: string; role: Role; fullName: string; username: string; name?: string | null; email?: string | null };
  }
}
