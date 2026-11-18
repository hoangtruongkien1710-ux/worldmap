import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Cài đặt" };

export default async function Page() {
  await guardPage("settings.manage");
  return (
    <>
      <PageHeader title="Cài đặt" subtitle="Thông tin trung tâm, tài khoản nhận học phí, danh mục" />
      <ComingSoon phase="Giai đoạn 1" items={[
        "Tên, khẩu hiệu, logo, lời cảm ơn trên phiếu",
        "Ngân hàng nhận học phí (mã QR)",
        "Danh mục môn, khối, phòng; học phí mặc định",
      ]} />
    </>
  );
}
