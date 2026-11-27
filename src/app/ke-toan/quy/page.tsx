import { PageHeader } from "@/components/layout/app-shell";
import { CashBookTable, BOOK_SORT_COLS } from "@/components/accounting/ui";
import { PeriodBar } from "@/components/accounting/period-bar";
import { db } from "@/lib/db";
import { VoucherButtons, VoucherRowMenu, loadVoucherLookups } from "@/components/accounting/vouchers";
import { can } from "@/lib/auth/permissions";
import { guardPage } from "@/lib/auth/session";
import { cashBook } from "@/lib/accounting/queries";
import { pickPeriod, type PeriodSP } from "@/lib/accounting/period";
import { parseSort } from "@/lib/sort";

export const metadata = { title: "Quỹ tiền mặt" };
export const dynamic = "force-dynamic";

type SP = PeriodSP & { xep?: string; chieu?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await guardPage("accounting.view");
  const post = can(user.role, "accounting.post");
  const sp = await searchParams;
  const period = pickPeriod(sp);
  const acc = await db.cashAccount.findFirst({ where: { kind: "CASH", active: true }, orderBy: { code: "asc" } });
  if (!acc) return <PageHeader title="Sổ quỹ tiền mặt" subtitle="Chưa khai báo quỹ tiền mặt" />;
  const [book, lookups] = await Promise.all([cashBook(acc.id, period.from, period.to), post ? loadVoucherLookups() : null]);
  return (
    <>
      <PageHeader title="Sổ quỹ tiền mặt" subtitle={`${acc.name} · ${period.label} · thu ${book.rows.filter((r) => r.in).length} phiếu, chi ${book.rows.filter((r) => r.out).length} phiếu`} actions={post && <VoucherButtons account={acc} />} />
      <PeriodBar base="/ke-toan/quy" period={period} params={sp} />
      <CashBookTable {...book} base="/ke-toan/quy" params={sp} sort={parseSort(sp, BOOK_SORT_COLS)}
        action={post && lookups ? (r) => <VoucherRowMenu r={r} {...lookups} /> : undefined} />
    </>
  );
}
