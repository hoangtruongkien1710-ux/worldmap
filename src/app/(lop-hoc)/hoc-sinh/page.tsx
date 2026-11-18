import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Học sinh" };

export default async function Page() {
  await guardPage("student.view");
  return (
    <>
      <PageHeader title="Học sinh" subtitle="Hồ sơ học sinh và ghi danh" />
      <ComingSoon phase="Giai đoạn 2" items={[
        "Danh sách, lọc theo lớp, khối, trạng thái",
        "Thêm học sinh, ghi danh nhiều lớp với ngày vào học",
        "Hồ sơ: lớp đang học, điểm danh, nhận xét, học phí",
      ]} />
    </>
  );
}
