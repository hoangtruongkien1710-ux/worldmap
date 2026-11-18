import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Ngân hàng" };

export default async function Page() {
  await guardPage("accounting.view");
  return (
    <>
      <PageHeader title="Ngân hàng" subtitle="Báo có, báo nợ, đối chiếu sao kê" />
      <ComingSoon phase="Giai đoạn 5b" items={[
        "Giấy báo có, báo nợ, chuyển tiền nội bộ",
        "Nhập sao kê và tự khớp, gợi ý gạch nợ học phí",
        "Sổ tiền gửi theo tài khoản",
      ]} />
    </>
  );
}
