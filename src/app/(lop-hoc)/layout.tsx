import { AppShell } from "@/components/layout/app-shell";
import { CLASSROOM_NAV } from "@/components/layout/nav";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { getBrand } from "@/lib/settings";

export default async function ClassroomLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const brand = await getBrand();
  const nav = CLASSROOM_NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(user.role, i.perm)) })).filter(
    (g) => g.items.length > 0,
  );
  return (
    <AppShell
      workspace="classroom"
      nav={nav}
      brand={brand}
      user={{ fullName: user.fullName, roleLabel: ROLE_LABEL[user.role] }}
      switchTo={can(user.role, "workspace.accounting") ? { href: "/ke-toan", label: "Sang Kế toán" } : undefined}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
