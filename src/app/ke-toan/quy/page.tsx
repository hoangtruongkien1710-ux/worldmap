import { PageHeader } from "@/components/layout/app-shell";
import { CashBookTable, MonthNav, monthLabel } from "@/components/accounting/ui";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { cashBook, pickMonth } from "@/lib/accounting/queries";

export const metadata = { title: "Quỹ tiền mặt" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ thang?: string }> }) {
  await guardPage("accounting.view");
  const month = pickMonth((await searchParams).thang);
  const acc = await db.cashAccount.findFirst({ where: { kind: "CASH", active: true }, orderBy: { code: "asc" } });
  if (!acc) return <PageHeader title="Sổ quỹ tiền mặt" subtitle="Chưa khai báo quỹ tiền mặt" />;
  const book = await cashBook(acc.id, month);
  return (
    <>
      <PageHeader title="Sổ quỹ tiền mặt" subtitle={`${acc.name} · ${monthLabel(month)} · thu ${book.rows.filter((r) => r.in).length} phiếu, chi ${book.rows.filter((r) => r.out).length} phiếu`} actions={<MonthNav month={month} base="/ke-toan/quy" />} />
      <CashBookTable {...book} />
    </>
  );
}
