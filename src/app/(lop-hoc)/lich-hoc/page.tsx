import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Lịch học" };

export default async function Page() {
  await guardPage("class.view");
  return (
    <>
      <PageHeader title="Lịch học" subtitle="Lịch cả tuần của mọi lớp" />
      <ComingSoon phase="Giai đoạn 1" items={[
        "Lưới 7 ngày theo tuần, lọc theo giáo viên",
        "Bấm vào buổi để điểm danh, cho nghỉ hoặc học lại",
        "Thêm buổi học bù",
      ]} />
    </>
  );
}
