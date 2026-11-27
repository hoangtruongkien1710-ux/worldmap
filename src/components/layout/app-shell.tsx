"use client";

import Link from "next/link";
import { PrintButton, usePrintMode } from "@/components/accounting/print-button";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  ArrowLeftRight, Banknote, BookOpen, CalendarDays, ChartColumn, CircleHelp, HandCoins, House, Landmark,
  LayoutDashboard, List, LogOut, Menu, Presentation, Receipt, Settings, ShoppingCart, UserCog, Users, Wallet, X,
} from "lucide-react";
import type { NavGroup } from "./nav";
import { TONE } from "@/components/ui/tone";

const ICONS = {
  home: House, calendar: CalendarDays, presentation: Presentation, users: Users, receipt: Receipt,
  "hand-coins": HandCoins, chart: ChartColumn, "user-cog": UserCog, settings: Settings, help: CircleHelp,
  layout: LayoutDashboard, wallet: Wallet, landmark: Landmark, shopping: ShoppingCart, banknote: Banknote,
  book: BookOpen, list: List,
} as const;

type Props = {
  workspace: "classroom" | "accounting";
  nav: NavGroup[];
  brand: { title: string; tagline: string; centerName: string; footer: string; logoUrl: string };
  user: { fullName: string; roleLabel: string };
  switchTo?: { href: string; label: string };
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
};

export function AppShell({ workspace, nav, brand, user, switchTo, signOutAction, children }: Props) {
  const pathname = usePathname();
  usePrintMode();
  const [open, setOpen] = useState(false);
  const accounting = workspace === "accounting";
  const isActive = (href: string) =>
    href === "/" || href === "/ke-toan" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const initials = user.fullName.split(" ").filter(Boolean).map((w) => w[0]).slice(-2).join("").toUpperCase();

  return (
    <div data-shell className="min-h-screen overflow-x-clip lg:pl-64">
      {open && <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/70 bg-white px-3 py-4 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center gap-3 px-2">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="Logo" className="h-12 w-12 shrink-0 object-contain" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-xl text-white">W</div>
          )}
          <div className="min-w-0">
            <div className={clsx("truncate font-extrabold tracking-tight", accounting ? "text-acc-700" : "text-brand-700")}>
              {accounting ? "KẾ TOÁN" : brand.title}
            </div>
            <div className="truncate text-[11px] uppercase tracking-wide text-slate-500">
              {accounting ? brand.centerName : brand.tagline}
            </div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Đóng menu"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto">
          {nav.map((g, i) => (
            <div key={i}>
              {g.title && <div className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.title}</div>}
              {g.items.map((it) => {
                const Icon = ICONS[it.icon as keyof typeof ICONS] ?? House;
                const active = isActive(it.href);
                const tone = TONE[it.tone];
                return (
                  <Link key={it.href} href={it.href} onClick={() => setOpen(false)}
                    className={clsx("group flex items-center gap-3 rounded-xl px-2 py-1.5 text-[15px] font-medium transition",
                      active
                        ? accounting ? "bg-acc-500 text-white shadow-md shadow-acc-500/25" : "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                        : "text-slate-700 hover:bg-slate-100")}>
                    <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                      active ? "bg-white/20 text-white" : clsx(tone.tile, tone.text, "group-hover:scale-105"))}>
                      <Icon size={17} strokeWidth={2.2} />
                    </span>
                    {it.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-3 space-y-2">
          <div className="rounded-xl bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
            <b className="block text-sm text-slate-800">{brand.centerName}</b>{brand.footer}
          </div>
          <form action={signOutAction}>
            <button className="btn w-full"><LogOut size={16} /> Đăng xuất</button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur lg:px-8">
        <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={22} /></button>
        <div className="flex-1" />
        {switchTo && (
          <Link href={switchTo.href} className="btn hidden sm:inline-flex"><ArrowLeftRight size={16} /> {switchTo.label}</Link>
        )}
        <div className="flex items-center gap-2.5">
          <span className={clsx("flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
            accounting ? "bg-acc-50 text-acc-700" : "bg-brand-50 text-brand-700")}>{initials}</span>
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-bold">{user.fullName}</div>
            <div className="text-xs text-slate-500">{user.roleLabel}</div>
          </div>
        </div>
      </header>
      <main data-main className="mx-auto max-w-[1400px] p-4 lg:p-8">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}<PrintButton /></div>
    </div>
  );
}

export function ComingSoon({ phase, items }: { phase: string; items: string[] }) {
  return (
    <div className="card p-6">
      <div className="badge mb-3 bg-amber-50 text-amber-700">Đang xây dựng · {phase}</div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
        {items.map((x) => <li key={x}>{x}</li>)}
      </ul>
    </div>
  );
}
