import { ComingSoon, PageHeader } from "@/components/layout/app-shell";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "Tổng hợp" };

export default async function Page() {
  await guardPage("accounting.view");
  return (
    <>
      <PageHeader title="Tổng hợp" subtitle="Sổ sách và khóa sổ" />
      <ComingSoon phase="Giai đoạn 5b" items={[
        "Bút toán khác, số dư đầu kỳ",
        "Nhật ký chung, sổ cái, cân đối phát sinh",
        "Khóa sổ và kết chuyển lãi lỗ",
      ]} />
    </>
  );
}
