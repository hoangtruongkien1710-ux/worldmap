import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Học viên" };

export default async function Page() {
  await guardPage("student.view");
  return (
    <>
      <PageHeader title="Học viên" subtitle="Hồ sơ học viên và ghi danh" />
      <ComingSoon phase="Giai đoạn 2" items={[
        "Danh sách, lọc theo lớp, khối, trạng thái",
        "Thêm học viên, ghi danh nhiều lớp với ngày vào học",
        "Hồ sơ: lớp đang học, điểm danh, nhận xét, học phí",
      ]} />
    </>
  );
}
