import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Học phí" };

export default async function Page() {
  await guardPage("tuition.view");
  return (
    <>
      <PageHeader title="Học phí" subtitle="Tự tính học phí theo tháng" />
      <ComingSoon phase="Giai đoạn 4" items={[
        "Phiếu gộp theo học viên và chi tiết theo lớp",
        "Thu tiền, thu một phần, chốt phiếu, điều chỉnh",
        "Phiếu thu có mã VietQR, sao chép ảnh gửi Zalo",
      ]} />
    </>
  );
}
