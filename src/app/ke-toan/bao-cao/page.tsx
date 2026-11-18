import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Báo cáo kế toán" };

export default async function Page() {
  await guardPage("accounting.view");
  return (
    <>
      <PageHeader title="Báo cáo kế toán" subtitle="6 báo cáo theo tần suất" />
      <ComingSoon phase="Giai đoạn 5b" items={[
        "Thu chi (ngày), công nợ (tuần), doanh thu (tuần)",
        "Chi phí, lương, kết quả kinh doanh (tháng)",
        "In, xuất Excel, gửi email theo lịch",
      ]} />
    </>
  );
}
