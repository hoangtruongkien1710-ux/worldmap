import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Hướng dẫn" };

export default async function Page() {
  await guardPage("class.view");
  return (
    <>
      <PageHeader title="Hướng dẫn" subtitle="Lộ trình xây dựng app" />
      <ComingSoon phase="Lộ trình" items={[
        "GĐ 0: khung app, đăng nhập, phân quyền, Docker (xong)",
        "GĐ 1: danh mục, lớp học, lịch học",
        "GĐ 2: học viên và ghi danh",
        "GĐ 3: điểm danh và nhận xét",
        "GĐ 4: học phí và công nợ",
        "GĐ 5: trang chủ đầy đủ, báo cáo",
        "GĐ 5b: kế toán kiểu MISA",
        "GĐ 6: chuyển dữ liệu và triển khai",
      ]} />
    </>
  );
}
