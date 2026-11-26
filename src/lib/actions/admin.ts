"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import type { ActionResult } from "@/components/ui/modal";
import { audit, int, opt, req, run, str, UserError } from "./util";

/* ---------------- Người dùng ---------------- */

const ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT", "TEACHER"] as const;
const UPATHS = ["/nguoi-dung", "/lop-hoc"];

function readRole(f: FormData) {
  const r = str(f, "role");
  if (!ROLES.includes(r as (typeof ROLES)[number])) throw new UserError("Chọn vai trò.");
  return r as (typeof ROLES)[number];
}
function checkPassword(p: string) {
  if (p.length < 8) throw new UserError("Mật khẩu cần ít nhất 8 ký tự.");
  return p;
}

const NAME_MAX = 60;
function readName(f: FormData) {
  const n = req(f, "fullName", "họ tên");
  if (n.length > NAME_MAX) throw new UserError(`Họ tên tối đa ${NAME_MAX} ký tự.`);
  return n;
}

export async function createUser(_: ActionResult, f: FormData) {
  return run(async () => {
    const me = await requirePermission("user.manage");
    const username = req(f, "username", "tên đăng nhập").toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new UserError("Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch (3–30 ký tự).");
    if (await db.user.findUnique({ where: { username }, select: { id: true } })) throw new UserError(`Tên đăng nhập “${username}” đã tồn tại, hãy chọn tên khác.`);
    const password = checkPassword(str(f, "password"));
    const branch = await db.branch.findFirst();
    const u = await db.user.create({
      data: { username, fullName: readName(f), role: readRole(f), phone: opt(f, "phone"), passwordHash: await bcrypt.hash(password, 10), branchId: branch?.id },
    });
    await audit(me.id, "create", "User", u.id, { username });
    return `Đã tạo tài khoản ${username}.`;
  }, UPATHS);
}

export async function updateUser(userId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const me = await requirePermission("user.manage");
    const role = readRole(f);
    if (userId === me.id && role !== "ADMIN") throw new UserError("Không thể tự bỏ quyền quản trị của chính mình.");
    await db.user.update({ where: { id: userId }, data: { fullName: readName(f), role, phone: opt(f, "phone") } });
    await audit(me.id, "update", "User", userId);
    return "Đã lưu tài khoản.";
  }, UPATHS);
}

export async function setUserActive(userId: string, active: boolean, _: ActionResult) {
  return run(async () => {
    const me = await requirePermission("user.manage");
    if (userId === me.id) throw new UserError("Không thể khóa tài khoản đang đăng nhập.");
    await db.user.update({ where: { id: userId }, data: { active } });
    await audit(me.id, active ? "unlock" : "lock", "User", userId);
    return active ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản. Người này không đăng nhập được nữa.";
  }, UPATHS);
}

export async function resetPassword(userId: string, _: ActionResult, f: FormData) {
  return run(async () => {
    const me = await requirePermission("user.manage");
    const p = checkPassword(str(f, "password"));
    if (p !== str(f, "password2")) throw new UserError("Hai lần nhập mật khẩu không khớp.");
    await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(p, 10) } });
    await audit(me.id, "reset-password", "User", userId);
    return "Đã đặt lại mật khẩu.";
  }, UPATHS);
}

export async function deleteUser(userId: string, _: ActionResult) {
  return run(async () => {
    const me = await requirePermission("user.manage");
    if (userId === me.id) throw new UserError("Không thể xóa tài khoản đang đăng nhập.");
    const n = await db.class.count({ where: { teacherId: userId } });
    if (n) throw new UserError(`Tài khoản đang được gán cho ${n} lớp. Hãy đổi giáo viên của các lớp đó hoặc khóa tài khoản thay vì xóa.`);
    await db.user.delete({ where: { id: userId } });
    await audit(me.id, "delete", "User", userId);
    return "Đã xóa tài khoản.";
  }, UPATHS);
}

/* ---------------- Cài đặt ---------------- */

const SPATHS = ["/cai-dat", "/"];

const GROUPS: Record<string, string[]> = {
  center: ["center.name", "center.sidebarTitle", "center.tagline", "center.phone", "center.address", "center.email", "center.hours", "center.thankYou"],
  bank: ["bank.name", "bank.accountNo", "bank.accountName", "bank.bin"],
};

export async function saveSettings(group: "center" | "bank", _: ActionResult, f: FormData) {
  return run(async () => {
    const me = await requirePermission("settings.manage");
    const ops = GROUPS[group].map((key) => {
      const value = str(f, key);
      return db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    });
    if (group === "bank") {
      const v = f.get("bank.qrEnabled") === "on";
      ops.push(db.setting.upsert({ where: { key: "bank.qrEnabled" }, update: { value: v }, create: { key: "bank.qrEnabled", value: v } }));
    }
    await db.$transaction(ops);
    await audit(me.id, "update", "Setting", group);
    return "Đã lưu cài đặt.";
  }, SPATHS);
}

type Kind = "room" | "subject" | "grade" | "program";
const LABEL: Record<Kind, string> = { room: "phòng học", subject: "môn học", grade: "đối tượng", program: "chương trình" };

export async function saveCatalog(kind: Kind, id: string | number | null, _: ActionResult, f: FormData) {
  return run(async () => {
    const me = await requirePermission("settings.manage");
    const name = req(f, "name", `tên ${LABEL[kind]}`);
    if (kind === "room") {
      const branch = await db.branch.findFirst();
      if (id) await db.room.update({ where: { id: Number(id) }, data: { name } });
      else await db.room.create({ data: { name, branchId: branch?.id } });
    } else if (kind === "subject") {
      if (id) await db.subject.update({ where: { id: Number(id) }, data: { name } });
      else await db.subject.create({ data: { name } });
    } else if (kind === "grade") {
      const order = int(f, "order") ?? 0;
      if (id) await db.grade.update({ where: { id: Number(id) }, data: { name, order } });
      else await db.grade.create({ data: { name, order } });
    } else {
      const color = str(f, "color") || "#2463eb";
      if (id) await db.program.update({ where: { id: String(id) }, data: { name, color } });
      else {
        const last = await db.program.findFirst({ orderBy: { order: "desc" } });
        await db.program.create({ data: { name, color, code: req(f, "code", "mã chương trình").toUpperCase(), order: (last?.order ?? 0) + 1 } });
      }
    }
    await audit(me.id, id ? "update" : "create", kind, id ? String(id) : undefined, { name });
    return id ? "Đã lưu." : `Đã thêm ${LABEL[kind]} ${name}.`;
  }, [...SPATHS, "/lop-hoc"]);
}

export async function deleteCatalog(kind: Kind, id: string | number, _: ActionResult) {
  return run(async () => {
    const me = await requirePermission("settings.manage");
    const used =
      kind === "room" ? await db.class.count({ where: { roomId: Number(id) } })
      : kind === "subject" ? await db.class.count({ where: { subjectId: Number(id) } })
      : kind === "grade" ? (await db.student.count({ where: { gradeId: Number(id) } })) + (await db.class.count({ where: { gradeId: Number(id) } }))
      : await db.course.count({ where: { programId: String(id) } });
    if (used) throw new UserError(`Không xóa được vì ${LABEL[kind]} này đang được dùng (${used}). Hãy đổi tên thay vì xóa.`);
    if (kind === "room") await db.room.delete({ where: { id: Number(id) } });
    else if (kind === "subject") await db.subject.delete({ where: { id: Number(id) } });
    else if (kind === "grade") await db.grade.delete({ where: { id: Number(id) } });
    else await db.program.delete({ where: { id: String(id) } });
    await audit(me.id, "delete", kind, String(id));
    return `Đã xóa ${LABEL[kind]}.`;
  }, [...SPATHS, "/lop-hoc"]);
}
