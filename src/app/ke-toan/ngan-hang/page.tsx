import { PageHeader } from "@/components/layout/app-shell";
import { CashBookTable, MonthNav, Tabs, monthLabel } from "@/components/accounting/ui";
import { db } from "@/lib/db";
import { VoucherButtons, VoucherRowMenu } from "@/components/accounting/vouchers";
import { can } from "@/lib/auth/permissions";
import { guardPage } from "@/lib/auth/session";
import { cashBook, pickMonth } from "@/lib/accounting/queries";

export const metadata = { title: "Ngân hàng" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ thang?: string; tk?: string }> }) {
  const user = await guardPage("accounting.view");
  const post = can(user.role, "accounting.post");
  const sp = await searchParams;
  const month = pickMonth(sp.thang);
  const banks = await db.cashAccount.findMany({ where: { kind: "BANK", active: true }, orderBy: { code: "desc" } });
  const acc = banks.find((b) => b.code === sp.tk) ?? banks[0];
  if (!acc) return <PageHeader title="Sổ tiền gửi ngân hàng" subtitle="Chưa khai báo tài khoản ngân hàng" />;
  const book = await cashBook(acc.id, month);
  return (
    <>
      <PageHeader title="Sổ tiền gửi ngân hàng" subtitle={`${acc.bankName} · STK ${acc.accountNo} · ${monthLabel(month)}`} actions={<>{post && <VoucherButtons account={acc} />}<MonthNav month={month} base="/ke-toan/ngan-hang" params={{ tk: acc.code }} /></>} />
      <div className="mb-4">
        <Tabs items={banks.map((b) => ({ href: `/ke-toan/ngan-hang?tk=${b.code}&thang=${month}`, label: b.name, active: b.id === acc.id }))} />
      </div>
      <CashBookTable {...book} action={post ? VoucherRowMenu : undefined} />
    </>
  );
}
