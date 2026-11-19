import { Building2, DoorOpen, Landmark, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { ActionForm, ConfirmButton, Field, Grid, ModalButton } from "@/components/ui/modal";
import { deleteCatalog, saveCatalog, saveSettings } from "@/lib/actions/admin";
import { PageHeader } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cài đặt" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await guardPage("settings.manage");
  const [s, branches, rooms, subjects, grades, programs] = await Promise.all([
    getSettings(),
    db.branch.findMany(),
    db.room.findMany({ include: { _count: { select: { classes: { where: { status: "OPEN" } } } } }, orderBy: { name: "asc" } }),
    db.subject.findMany({ include: { _count: { select: { classes: true } } } }),
    db.grade.findMany({ include: { _count: { select: { students: true } } }, orderBy: { order: "asc" } }),
    db.program.findMany({ include: { _count: { select: { courses: true } } }, orderBy: { order: "asc" } }),
  ]);
  const v = (k: string) => String(s[k] ?? "");
  const qr = v("bank.bin") && v("bank.accountNo")
    ? `https://img.vietqr.io/image/${v("bank.bin")}-${v("bank.accountNo")}-compact2.png?amount=3715000&addInfo=${encodeURIComponent("HV0001 HSK1")}&accountName=${encodeURIComponent(v("bank.accountName"))}`
    : null;

  return (
    <>
      <PageHeader title="Cài đặt" subtitle="Thông tin trung tâm, tài khoản nhận học phí và danh mục dùng chung" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card icon={<Building2 size={18} />} title="Trung tâm" tone="text-brand-600 bg-brand-50" action={
          <ModalButton label="Sửa" icon={<Pencil size={15} />} title="Sửa thông tin trung tâm" size="lg">
            <ActionForm action={saveSettings.bind(null, "center")}>
              <Grid>
                <Field label="Tên hiển thị"><input name="center.name" defaultValue={v("center.name")} required className="input" /></Field>
                <Field label="Tên trên thanh bên"><input name="center.sidebarTitle" defaultValue={v("center.sidebarTitle")} className="input" /></Field>
              </Grid>
              <Field label="Khẩu hiệu"><input name="center.tagline" defaultValue={v("center.tagline")} className="input" /></Field>
              <Grid>
                <Field label="Điện thoại"><input name="center.phone" defaultValue={v("center.phone")} className="input" /></Field>
                <Field label="Email"><input name="center.email" type="email" defaultValue={v("center.email")} className="input" /></Field>
              </Grid>
              <Field label="Địa chỉ"><input name="center.address" defaultValue={v("center.address")} className="input" /></Field>
              <Field label="Giờ làm việc"><input name="center.hours" defaultValue={v("center.hours")} className="input" /></Field>
              <Field label="Lời cảm ơn trên phiếu thu"><textarea name="center.thankYou" defaultValue={v("center.thankYou")} rows={2} className="input" /></Field>
            </ActionForm>
          </ModalButton>
        }>
          <Info label="Tên hiển thị" value={v("center.name")} />
          <Info label="Khẩu hiệu" value={v("center.tagline")} />
          <Info label="Điện thoại" value={v("center.phone")} />
          <Info label="Địa chỉ" value={v("center.address")} />
          <Info label="Email" value={v("center.email")} />
          <Info label="Giờ làm việc" value={v("center.hours")} />
          <Info label="Lời cảm ơn trên phiếu thu" value={v("center.thankYou")} />
          <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Cơ sở: {branches.map((b) => `${b.name} (${b.code})`).join(", ")}
          </div>
        </Card>

        <Card icon={<Landmark size={18} />} title="Tài khoản nhận học phí (VietQR)" tone="text-emerald-600 bg-emerald-50" action={
          <ModalButton label="Sửa" icon={<Pencil size={15} />} title="Tài khoản nhận học phí">
            <ActionForm action={saveSettings.bind(null, "bank")}>
              <Grid>
                <Field label="Ngân hàng"><input name="bank.name" defaultValue={v("bank.name")} className="input" placeholder="Vietcombank" /></Field>
                <Field label="Mã BIN" hint="VD: Vietcombank 970436"><input name="bank.bin" defaultValue={v("bank.bin")} inputMode="numeric" className="input" /></Field>
              </Grid>
              <Grid>
                <Field label="Số tài khoản"><input name="bank.accountNo" defaultValue={v("bank.accountNo")} inputMode="numeric" className="input" /></Field>
                <Field label="Chủ tài khoản"><input name="bank.accountName" defaultValue={v("bank.accountName")} className="input uppercase" /></Field>
              </Grid>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="bank.qrEnabled" defaultChecked={!!s["bank.qrEnabled"]} className="h-4 w-4" /> In mã QR trên phiếu thu</label>
            </ActionForm>
          </ModalButton>
        }>
          <div className="flex flex-wrap gap-5">
            <div className="min-w-0 flex-1">
              <Info label="Ngân hàng" value={v("bank.name")} />
              <Info label="Số tài khoản" value={v("bank.accountNo")} />
              <Info label="Chủ tài khoản" value={v("bank.accountName")} />
              <Info label="Mã BIN" value={v("bank.bin")} />
              <Info label="In QR trên phiếu thu" value={s["bank.qrEnabled"] ? "Bật" : "Tắt"} />
            </div>
            {qr && (
              <figure className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Mã QR mẫu" className="h-40 w-40 rounded-xl border border-slate-100" />
                <figcaption className="mt-1 text-[11px] text-slate-500">QR mẫu: 3.715.000đ · HV0001 HSK1</figcaption>
              </figure>
            )}
          </div>
          <p className="mt-2 text-xs text-amber-600">Đây là số tài khoản mẫu, hãy thay bằng tài khoản thật trước khi dùng.</p>
        </Card>

        <Card icon={<DoorOpen size={18} />} title="Phòng học" tone="text-rose-600 bg-rose-50" action={<AddButton kind="room" label="Thêm phòng" />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {rooms.map((r) => (
              <div key={r.id} className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-1"><span className="font-semibold">{r.name}</span><ItemActions kind="room" id={r.id} name={r.name} /></div>
                <div className="text-xs text-slate-500">{r._count.classes} lớp đang dùng</div>
              </div>
            ))}
          </div>
        </Card>

        <Card icon={<Tags size={18} />} title="Danh mục" tone="text-violet-600 bg-violet-50">
          <List title="Chương trình" kind="program" items={programs.map((p) => ({ id: p.id, name: p.name, color: p.color, note: `${p._count.courses} khóa` }))} />
          <List title="Môn học" kind="subject" items={subjects.map((x) => ({ id: x.id, name: x.name, note: `${x._count.classes} lớp` }))} />
          <List title="Đối tượng học viên" kind="grade" items={grades.map((g) => ({ id: g.id, name: g.name, order: g.order, note: `${g._count.students} học viên` }))} />
        </Card>
      </div>
      <p className="mt-4 text-xs text-slate-400">Mục đang được dùng (có lớp, khóa hoặc học viên) không xóa được, chỉ đổi tên.</p>
    </>
  );
}

function Card({ icon, title, tone, action, children }: { icon: React.ReactNode; title: string; tone: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>{icon}</span>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1 text-sm">
      <span className="w-36 shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 font-medium">{value || <span className="text-slate-400">Chưa nhập</span>}</span>
    </div>
  );
}
type Kind = "room" | "subject" | "grade" | "program";
type Item = { id: string | number; name: string; color?: string; order?: number; note?: string };
const KIND_LABEL: Record<Kind, string> = { room: "phòng học", subject: "môn học", grade: "đối tượng", program: "chương trình" };

function CatalogFields({ kind, item }: { kind: Kind; item?: Item }) {
  return (
    <>
      <Field label={`Tên ${KIND_LABEL[kind]}`}><input name="name" defaultValue={item?.name} required className="input" /></Field>
      {kind === "program" && (
        <Grid>
          {!item && <Field label="Mã" hint="VD: HSK, IELTS"><input name="code" required className="input uppercase" /></Field>}
          <Field label="Màu"><input name="color" type="color" defaultValue={item?.color ?? "#2463eb"} className="h-10 w-20 rounded-lg border border-slate-200" /></Field>
        </Grid>
      )}
      {kind === "grade" && <Field label="Thứ tự hiển thị"><input name="order" type="number" defaultValue={item?.order ?? 0} className="input" /></Field>}
    </>
  );
}

function AddButton({ kind, label }: { kind: Kind; label: string }) {
  return (
    <ModalButton variant="bare" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-brand-600 hover:bg-brand-50" label={label} icon={<Plus size={15} />} title={`Thêm ${KIND_LABEL[kind]}`} size="sm">
      <ActionForm action={saveCatalog.bind(null, kind, null)} submitLabel="Thêm"><CatalogFields kind={kind} /></ActionForm>
    </ModalButton>
  );
}

function ItemActions({ kind, id, name, item }: { kind: Kind; id: string | number; name: string; item?: Item }) {
  return (
    <span className="inline-flex items-center">
      <ModalButton variant="bare" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" label={<Pencil size={13} />} title={`Sửa ${KIND_LABEL[kind]}`} subtitle={name} size="sm">
        <ActionForm action={saveCatalog.bind(null, kind, id)}><CatalogFields kind={kind} item={item ?? { id, name }} /></ActionForm>
      </ModalButton>
      <ConfirmButton variant="bare" className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" label={<Trash2 size={13} />} title={`Xóa ${KIND_LABEL[kind]} “${name}”?`} message="Chỉ xóa được khi chưa có dữ liệu nào dùng mục này." action={deleteCatalog.bind(null, kind, id)} />
    </span>
  );
}

function List({ title, kind, items }: { title: string; kind: Kind; items: Item[] }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</span>
        <AddButton kind={kind} label="Thêm" />
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <span key={i.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 py-0.5 pl-3 pr-1 text-sm ring-1 ring-slate-200">
            {i.color && <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />}{i.name}<span className="text-xs text-slate-400">· {i.note}</span>
            <ItemActions kind={kind} id={i.id} name={i.name} item={i} />
          </span>
        ))}
      </div>
    </div>
  );
}
