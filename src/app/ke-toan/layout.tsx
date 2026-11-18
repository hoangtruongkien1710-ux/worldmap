import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ACCOUNTING_NAV } from "@/components/layout/nav";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { getBrand } from "@/lib/settings";

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Chặn lần hai ở server (ngoài middleware): giáo viên, quản lý không vào được.
  if (!can(user.role, "workspace.accounting")) redirect("/?loi=khong-co-quyen");
  const brand = await getBrand();
  const nav = ACCOUNTING_NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(user.role, i.perm)) }));
  return (
    <AppShell
      workspace="accounting"
      nav={nav}
      brand={brand}
      user={{ fullName: user.fullName, roleLabel: ROLE_LABEL[user.role] }}
      switchTo={{ href: "/", label: "Sang Lớp học" }}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
