import { PageHeader } from "@/components/layout/app-shell";
import { CashBookTable, BOOK_SORT_COLS, Tabs } from "@/components/accounting/ui";
import { PeriodBar, qs } from "@/components/accounting/period-bar";
import { db } from "@/lib/db";
import { VoucherButtons, VoucherRowMenu, loadVoucherLookups } from "@/components/accounting/vouchers";
import { can } from "@/lib/auth/permissions";
import { guardPage } from "@/lib/auth/session";
import { cashBook } from "@/lib/accounting/queries";
import { pickPeriod, type PeriodSP } from "@/lib/accounting/period";
import { parseSort } from "@/lib/sort";

export const metadata = { title: "Ngân hàng" };
export const dynamic = "force-dynamic";

type SP = PeriodSP & { tk?: string; xep?: string; chieu?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await guardPage("accounting.view");
  const post = can(user.role, "accounting.post");
  const sp = await searchParams;
  const period = pickPeriod(sp);
  const banks = await db.cashAccount.findMany({ where: { kind: "BANK", active: true }, orderBy: { code: "desc" } });
  const acc = banks.find((b) => b.code === sp.tk) ?? banks[0];
  if (!acc) return <PageHeader title="Sổ tiền gửi ngân hàng" subtitle="Chưa khai báo tài khoản ngân hàng" />;
  const params = { ...sp, tk: acc.code };
  const [book, lookups] = await Promise.all([cashBook(acc.id, period.from, period.to), post ? loadVoucherLookups() : null]);
  return (
    <>
      <PageHeader title="Sổ tiền gửi ngân hàng" subtitle={`${acc.bankName} · STK ${acc.accountNo} · ${period.label}`} actions={post && <VoucherButtons account={acc} />} />
      <div className="mb-4">
        <Tabs items={banks.map((b) => ({ href: `/ke-toan/ngan-hang${qs(params, { tk: b.code })}`, label: b.name, active: b.id === acc.id }))} />
      </div>
      <PeriodBar base="/ke-toan/ngan-hang" period={period} params={params} />
      <CashBookTable {...book} base="/ke-toan/ngan-hang" params={params} sort={parseSort(sp, BOOK_SORT_COLS)}
        action={post && lookups ? (r) => <VoucherRowMenu r={r} {...lookups} /> : undefined} />
    </>
  );
}
