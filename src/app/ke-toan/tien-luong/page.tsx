import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Tiền lương" };

export default async function Page() {
  await guardPage("payroll.view");
  return (
    <>
      <PageHeader title="Tiền lương" subtitle="Nhập bảng lương đã chốt" />
      <ComingSoon phase="Giai đoạn 5b" items={[
        "Tải file Excel bảng lương, kiểm tra và xem trước",
        "Chốt kỳ lương, chi trả lương",
        "Báo cáo lương tháng",
      ]} />
    </>
  );
}
