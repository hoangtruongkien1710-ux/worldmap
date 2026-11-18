import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Người dùng" };

export default async function Page() {
  await guardPage("user.manage");
  return (
    <>
      <PageHeader title="Người dùng" subtitle="Tài khoản quản trị, quản lý, kế toán, giáo viên" />
      <ComingSoon phase="Giai đoạn 1" items={[
        "Thêm, sửa, khóa tài khoản",
        "Gán lớp phụ trách cho giáo viên",
      ]} />
    </>
  );
}
