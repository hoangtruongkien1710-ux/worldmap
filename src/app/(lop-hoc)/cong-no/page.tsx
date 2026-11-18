import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Công nợ" };

export default async function Page() {
  await guardPage("tuition.view");
  return (
    <>
      <PageHeader title="Công nợ" subtitle="Học viên còn nợ học phí" />
      <ComingSoon phase="Giai đoạn 4" items={[
        "Tổng công nợ, nợ các tháng trước",
        "Thu theo từng tháng, phiếu nhắc học phí",
      ]} />
    </>
  );
}
