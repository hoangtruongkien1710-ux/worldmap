import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Lớp học" };

export default async function Page() {
  await guardPage("class.view");
  return (
    <>
      <PageHeader title="Lớp học" subtitle="Danh sách lớp, lịch và cách tính học phí" />
      <ComingSoon phase="Giai đoạn 1" items={[
        "Thẻ lớp: lịch, giáo viên, phòng, sĩ số, cách tính học phí",
        "Thêm và sửa lớp, chọn ngày trong tuần, mỗi ngày một giờ riêng",
        "4 cách tính học phí, miễn giảm vắng phép",
        "Chi tiết lớp: học sinh, điểm danh, học phí, công nợ, nhận xét",
      ]} />
    </>
  );
}
