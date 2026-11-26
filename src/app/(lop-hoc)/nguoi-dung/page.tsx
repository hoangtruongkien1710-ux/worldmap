import { KeyRound, Lock, LockOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { ActionForm, ConfirmButton, Field, Grid, ModalButton, RowMenu } from "@/components/ui/modal";
import { PasswordInput } from "@/components/ui/password-input";
import { createUser, deleteUser, resetPassword, setUserActive, updateUser } from "@/lib/actions/admin";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Người dùng" };
export const dynamic = "force-dynamic";

const ROLE_CLS: Record<string, string> = {
  ADMIN: "bg-slate-900 text-white",
  MANAGER: "bg-indigo-50 text-indigo-700",
  ACCOUNTANT: "bg-emerald-50 text-emerald-700",
  TEACHER: "bg-sky-50 text-sky-700",
};
const ROLE_NOTE: Record<string, string> = {
  ADMIN: "Toàn quyền, vào được cả Lớp học và Kế toán",
  MANAGER: "Quản lý lớp, học viên, học phí; không vào Kế toán",
  ACCOUNTANT: "Thu học phí, công nợ và toàn bộ Kế toán",
  TEACHER: "Chỉ thấy lớp mình dạy, điểm danh và nhận xét",
};

export default async function Page() {
  const me = await guardPage("user.manage");
  const users = await db.user.findMany({
    include: { classes: { where: { status: "OPEN" }, select: { code: true, color: true } } },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
  });
  return (
    <>
      <PageHeader title="Người dùng" subtitle={`${users.length} tài khoản · mật khẩu mẫu Worldmap@2026, cần đổi trước khi dùng thật`}
        actions={
          <ModalButton variant="primary" label="Thêm tài khoản" icon={<Plus size={16} />} title="Thêm tài khoản">
            <ActionForm action={createUser} submitLabel="Tạo tài khoản">
              <UserFields />
              <Field label="Mật khẩu ban đầu" hint="Ít nhất 8 ký tự, gửi cho người dùng và nhắc họ đổi"><PasswordInput name="password" required minLength={8} autoComplete="new-password" /></Field>
            </ActionForm>
          </ModalButton>
        } />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(ROLE_NOTE).map(([r, note]) => (
          <div key={r} className="card p-4">
            <span className={`badge ${ROLE_CLS[r]}`}>{ROLE_LABEL[r as keyof typeof ROLE_LABEL]}</span>
            <div className="mt-2 text-2xl font-extrabold">{users.filter((u) => u.role === r).length}</div>
            <div className="text-xs text-slate-500">{note}</div>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Họ tên</th><th className="px-3 py-3">Tên đăng nhập</th><th className="px-3 py-3">Vai trò</th><th className="px-3 py-3">Điện thoại</th><th className="px-3 py-3">Lớp đang dạy</th><th className="px-4 py-3">Trạng thái</th><th className="w-12" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5"><div className="font-semibold">{u.fullName}</div><div className="text-xs text-slate-500">Tạo {fmtDate(u.createdAt)}</div></td>
                  <td className="px-3 py-2.5 font-mono text-[13px]">{u.username}</td>
                  <td className="px-3 py-2.5"><span className={`badge ${ROLE_CLS[u.role]}`}>{ROLE_LABEL[u.role]}</span></td>
                  <td className="px-3 py-2.5 text-slate-600">{u.phone}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {u.classes.length === 0 ? <span className="text-slate-400">—</span> : u.classes.map((c) => (
                        <span key={c.code} className="badge gap-1 bg-slate-100 text-slate-700"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />{c.code}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{u.active ? <span className="badge bg-green-50 text-green-700">Đang dùng</span> : <span className="badge bg-slate-100 text-slate-500">Đã khóa</span>}</td>
                  <td className="px-2 py-2.5 text-right">
                    <RowMenu>
                      <ModalButton variant="menu" label="Sửa thông tin" icon={<Pencil size={15} />} title={`Sửa tài khoản ${u.username}`}>
                        <ActionForm action={updateUser.bind(null, u.id)}><UserFields u={u} /></ActionForm>
                      </ModalButton>
                      <ModalButton variant="menu" label="Đặt lại mật khẩu" icon={<KeyRound size={15} />} title={`Đặt lại mật khẩu · ${u.fullName}`} subtitle={u.username} size="sm">
                        <ActionForm action={resetPassword.bind(null, u.id)} submitLabel="Đặt lại">
                          <Field label="Mật khẩu mới"><PasswordInput name="password" required minLength={8} autoComplete="new-password" /></Field>
                          <Field label="Nhập lại"><PasswordInput name="password2" required minLength={8} autoComplete="new-password" /></Field>
                        </ActionForm>
                      </ModalButton>
                      {u.id !== me.id && (u.active ? (
                        <ConfirmButton variant="menu" label="Khóa tài khoản" icon={<Lock size={15} />} title={`Khóa ${u.username}?`} confirmLabel="Khóa"
                          message="Người này sẽ không đăng nhập được nữa. Dữ liệu lớp, điểm danh vẫn giữ nguyên, có thể mở khóa lại." action={setUserActive.bind(null, u.id, false)} />
                      ) : (
                        <ConfirmButton variant="menu" label="Mở khóa" icon={<LockOpen size={15} />} title={`Mở khóa ${u.username}?`} confirmLabel="Mở khóa" message="Người này đăng nhập lại được." action={setUserActive.bind(null, u.id, true)} />
                      ))}
                      {u.id !== me.id && (
                        <ConfirmButton label="Xóa tài khoản" icon={<Trash2 size={15} />} title={`Xóa tài khoản ${u.username}?`}
                          message="Chỉ xóa được tài khoản chưa gán lớp nào. Nếu người này đã nghỉ, nên khóa tài khoản để giữ lịch sử." action={deleteUser.bind(null, u.id)} />
                      )}
                    </RowMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function UserFields({ u }: { u?: { username: string; fullName: string; role: string; phone: string | null } }) {
  return (
    <>
      <Grid>
        <Field label="Họ tên" hint="Tối đa 60 ký tự"><input name="fullName" defaultValue={u?.fullName} required maxLength={60} className="input" /></Field>
        <Field label="Tên đăng nhập" hint={u ? "Không đổi được" : "Chữ không dấu, VD: gv.lan"}>
          <input name="username" defaultValue={u?.username} disabled={!!u} required={!u} className="input font-mono" autoComplete="off" />
        </Field>
      </Grid>
      <Grid>
        <Field label="Vai trò">
          <select name="role" defaultValue={u?.role ?? "TEACHER"} className="input">
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Điện thoại"><input name="phone" defaultValue={u?.phone ?? ""} inputMode="tel" className="input" /></Field>
      </Grid>
    </>
  );
}
