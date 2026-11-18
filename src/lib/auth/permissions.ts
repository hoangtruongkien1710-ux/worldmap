export type Role = "ADMIN" | "MANAGER" | "ACCOUNTANT" | "TEACHER";

export type Action =
  | "workspace.classroom"
  | "workspace.accounting"
  | "class.view"
  | "class.manage"
  | "student.view"
  | "student.manage"
  | "attendance.take"
  | "tuition.view"
  | "tuition.collect"
  | "report.view"
  | "user.manage"
  | "settings.manage"
  | "accounting.view"
  | "accounting.post"
  | "payroll.view";

const MATRIX: Record<Role, Action[]> = {
  ADMIN: [
    "workspace.classroom", "workspace.accounting", "class.view", "class.manage", "student.view",
    "student.manage", "attendance.take", "tuition.view", "tuition.collect", "report.view",
    "user.manage", "settings.manage", "accounting.view", "accounting.post", "payroll.view",
  ],
  MANAGER: [
    "workspace.classroom", "class.view", "class.manage", "student.view", "student.manage",
    "attendance.take", "tuition.view", "tuition.collect", "report.view",
  ],
  ACCOUNTANT: [
    "workspace.classroom", "workspace.accounting", "class.view", "student.view", "tuition.view",
    "tuition.collect", "report.view", "accounting.view", "accounting.post", "payroll.view",
  ],
  TEACHER: ["workspace.classroom", "class.view", "student.view", "attendance.take"],
};

export function can(role: Role | undefined | null, action: Action): boolean {
  return !!role && MATRIX[role].includes(action);
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  ACCOUNTANT: "Kế toán",
  TEACHER: "Giáo viên",
};
