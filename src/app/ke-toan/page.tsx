import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Tổng quan kế toán" };

export default async function Page() {
  await guardPage("accounting.view");
  return (
    <>
      <PageHeader title="Tổng quan kế toán" subtitle="Tồn quỹ, thu chi, công nợ, lãi lỗ tạm tính" />
      <ComingSoon phase="Giai đoạn 5b" items={[
        "Tồn quỹ tiền mặt và ngân hàng hôm nay",
        "Thu chi trong tháng, công nợ phải thu và phải trả",
        "Việc cần làm: chứng từ chờ duyệt, sao kê chưa khớp",
      ]} />
    </>
  );
}
