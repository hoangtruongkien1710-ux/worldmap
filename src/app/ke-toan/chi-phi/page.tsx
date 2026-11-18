import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Chi phí & mua hàng" };

export default async function Page() {
  await guardPage("accounting.view");
  return (
    <>
      <PageHeader title="Chi phí & mua hàng" subtitle="Chi phí, nhà cung cấp, phải trả" />
      <ComingSoon phase="Giai đoạn 5b" items={[
        "Chứng từ chi phí, chi phí định kỳ",
        "Hóa đơn nhà cung cấp, trả tiền",
        "Sổ chi tiết phải trả, báo cáo chi phí",
      ]} />
    </>
  );
}
