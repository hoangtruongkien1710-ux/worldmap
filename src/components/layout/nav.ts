import type { Action } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: string; perm: Action };
export type NavGroup = { title?: string; items: NavItem[] };

// Tên icon lấy từ lucide-react (map ở app-shell.tsx).
export const CLASSROOM_NAV: NavGroup[] = [
  { items: [
    { href: "/", label: "Trang chủ", icon: "home", perm: "class.view" },
    { href: "/lich-hoc", label: "Lịch học", icon: "calendar", perm: "class.view" },
    { href: "/lop-hoc", label: "Lớp học", icon: "presentation", perm: "class.view" },
    { href: "/hoc-sinh", label: "Học sinh", icon: "users", perm: "student.view" },
  ] },
  { title: "Tài chính", items: [
    { href: "/hoc-phi", label: "Học phí", icon: "receipt", perm: "tuition.view" },
    { href: "/cong-no", label: "Công nợ", icon: "hand-coins", perm: "tuition.view" },
    { href: "/bao-cao", label: "Báo cáo", icon: "chart", perm: "report.view" },
  ] },
  { title: "Quản trị", items: [
    { href: "/nguoi-dung", label: "Người dùng", icon: "user-cog", perm: "user.manage" },
    { href: "/cai-dat", label: "Cài đặt", icon: "settings", perm: "settings.manage" },
  ] },
  { title: "Khác", items: [{ href: "/huong-dan", label: "Hướng dẫn", icon: "help", perm: "class.view" }] },
];

export const ACCOUNTING_NAV: NavGroup[] = [
  { items: [{ href: "/ke-toan", label: "Tổng quan", icon: "layout", perm: "accounting.view" }] },
  { title: "Nghiệp vụ", items: [
    { href: "/ke-toan/quy", label: "Quỹ tiền mặt", icon: "wallet", perm: "accounting.view" },
    { href: "/ke-toan/ngan-hang", label: "Ngân hàng", icon: "landmark", perm: "accounting.view" },
    { href: "/ke-toan/hoc-phi", label: "Học phí & thu khác", icon: "receipt", perm: "accounting.view" },
    { href: "/ke-toan/chi-phi", label: "Chi phí & mua hàng", icon: "shopping", perm: "accounting.view" },
    { href: "/ke-toan/tien-luong", label: "Tiền lương", icon: "banknote", perm: "payroll.view" },
    { href: "/ke-toan/tong-hop", label: "Tổng hợp", icon: "book", perm: "accounting.view" },
  ] },
  { title: "Báo cáo & danh mục", items: [
    { href: "/ke-toan/bao-cao", label: "Báo cáo", icon: "chart", perm: "accounting.view" },
    { href: "/ke-toan/danh-muc", label: "Danh mục", icon: "list", perm: "accounting.view" },
  ] },
];
