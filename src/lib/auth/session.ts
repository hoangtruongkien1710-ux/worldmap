import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, type Action } from "./permissions";

/** Lấy người dùng hiện tại, bắt buộc đăng nhập (dùng trong Server Component / Server Action). */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  return session.user;
}

/** Bắt buộc có quyền; nếu không thì ném lỗi (Server Action) – luôn kiểm tra ở server. */
export async function requirePermission(action: Action) {
  const user = await requireUser();
  if (!can(user.role, action)) throw new Error("Bạn không có quyền thực hiện thao tác này.");
  return user;
}

/** Dùng trong trang: không đủ quyền thì quay về trang chủ. */
export async function guardPage(action: Action) {
  const user = await requireUser();
  if (!can(user.role, action)) redirect("/?loi=khong-co-quyen");
  return user;
}
