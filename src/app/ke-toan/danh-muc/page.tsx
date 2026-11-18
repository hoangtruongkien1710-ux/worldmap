import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Danh mục" };

export default async function Page() {
  await guardPage("accounting.view");
  return (
    <>
      <PageHeader title="Danh mục" subtitle="Tài khoản, quỹ, khoản mục, nhà cung cấp, nhân viên" />
      <ComingSoon phase="Giai đoạn 5b" items={[
        "Hệ thống tài khoản rút gọn TT133",
        "Quỹ và tài khoản ngân hàng",
        "Khoản mục thu chi, nhà cung cấp, nhân viên",
      ]} />
    </>
  );
}
