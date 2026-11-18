import type { Action } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: string; perm: Action; tone: Tone };
export type Tone = "blue" | "violet" | "indigo" | "sky" | "emerald" | "amber" | "rose" | "orange" | "teal" | "slate" | "cyan" | "fuchsia";
export type NavGroup = { title?: string; items: NavItem[] };

// Tên icon lấy từ lucide-react (map ở app-shell.tsx).
export const CLASSROOM_NAV: NavGroup[] = [
  { items: [
    { href: "/", label: "Trang chủ", icon: "home", perm: "class.view", tone: "blue" },
    { href: "/lich-hoc", label: "Lịch học", icon: "calendar", perm: "class.view", tone: "violet" },
    { href: "/lop-hoc", label: "Lớp học", icon: "presentation", perm: "class.view", tone: "indigo" },
    { href: "/hoc-sinh", label: "Học viên", icon: "users", perm: "student.view", tone: "sky" },
  ] },
  { title: "Tài chính", items: [
    { href: "/hoc-phi", label: "Học phí", icon: "receipt", perm: "tuition.view", tone: "emerald" },
    { href: "/cong-no", label: "Công nợ", icon: "hand-coins", perm: "tuition.view", tone: "rose" },
    { href: "/bao-cao", label: "Báo cáo", icon: "chart", perm: "report.view", tone: "amber" },
  ] },
  { title: "Quản trị", items: [
    { href: "/nguoi-dung", label: "Người dùng", icon: "user-cog", perm: "user.manage", tone: "cyan" },
    { href: "/cai-dat", label: "Cài đặt", icon: "settings", perm: "settings.manage", tone: "slate" },
  ] },
  { title: "Khác", items: [{ href: "/huong-dan", label: "Hướng dẫn", icon: "help", perm: "class.view", tone: "fuchsia" }] },
];

export const ACCOUNTING_NAV: NavGroup[] = [
  { items: [{ href: "/ke-toan", label: "Tổng quan", icon: "layout", perm: "accounting.view", tone: "teal" }] },
  { title: "Nghiệp vụ", items: [
    { href: "/ke-toan/quy", label: "Quỹ tiền mặt", icon: "wallet", perm: "accounting.view", tone: "emerald" },
    { href: "/ke-toan/ngan-hang", label: "Ngân hàng", icon: "landmark", perm: "accounting.view", tone: "blue" },
    { href: "/ke-toan/hoc-phi", label: "Học phí & thu khác", icon: "receipt", perm: "accounting.view", tone: "sky" },
    { href: "/ke-toan/chi-phi", label: "Chi phí & mua hàng", icon: "shopping", perm: "accounting.view", tone: "orange" },
    { href: "/ke-toan/tien-luong", label: "Tiền lương", icon: "banknote", perm: "payroll.view", tone: "violet" },
    { href: "/ke-toan/tong-hop", label: "Tổng hợp", icon: "book", perm: "accounting.view", tone: "indigo" },
  ] },
  { title: "Báo cáo & danh mục", items: [
    { href: "/ke-toan/bao-cao", label: "Báo cáo", icon: "chart", perm: "accounting.view", tone: "amber" },
    { href: "/ke-toan/danh-muc", label: "Danh mục", icon: "list", perm: "accounting.view", tone: "slate" },
  ] },
];
