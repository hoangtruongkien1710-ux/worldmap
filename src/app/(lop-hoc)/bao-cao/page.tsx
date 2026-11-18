import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Báo cáo" };

export default async function Page() {
  await guardPage("report.view");
  return (
    <>
      <PageHeader title="Báo cáo" subtitle="Doanh thu, chuyên cần, học viên, lớp học" />
      <ComingSoon phase="Giai đoạn 5" items={[
        "4 tab, so sánh với tháng trước",
        "In và xuất Excel 3 sheet",
      ]} />
    </>
  );
}
