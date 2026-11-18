import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Học phí & thu khác" };

export default async function Page() {
  await guardPage("accounting.view");
  return (
    <>
      <PageHeader title="Học phí & thu khác" subtitle="Doanh thu và phải thu" />
      <ComingSoon phase="Giai đoạn 5b" items={[
        "Tự lấy phiếu học phí và các lần thu từ phần lớp học",
        "Thu khác: giáo trình, phí thi",
        "Sổ chi tiết công nợ phải thu, tuổi nợ",
      ]} />
    </>
  );
}
