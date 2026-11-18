import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Quỹ tiền mặt" };

export default async function Page() {
  await guardPage("accounting.view");
  return (
    <>
      <PageHeader title="Quỹ tiền mặt" subtitle="Phiếu thu, phiếu chi, kiểm kê quỹ" />
      <ComingSoon phase="Giai đoạn 5b" items={[
        "Phiếu thu, phiếu chi có chứng từ ảnh",
        "Kiểm kê quỹ theo mệnh giá",
        "Sổ quỹ, báo cáo thu chi hằng ngày",
      ]} />
    </>
  );
}
