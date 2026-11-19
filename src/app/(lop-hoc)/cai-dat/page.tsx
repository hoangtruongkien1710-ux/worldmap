import { Building2, DoorOpen, GraduationCap, Landmark, Tags } from "lucide-react";
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
        <Card icon={<Building2 size={18} />} title="Trung tâm" tone="text-brand-600 bg-brand-50">
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

        <Card icon={<Landmark size={18} />} title="Tài khoản nhận học phí (VietQR)" tone="text-emerald-600 bg-emerald-50">
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

        <Card icon={<DoorOpen size={18} />} title="Phòng học" tone="text-rose-600 bg-rose-50">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {rooms.map((r) => (
              <div key={r.id} className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-slate-500">{r._count.classes} lớp đang dùng</div>
              </div>
            ))}
          </div>
        </Card>

        <Card icon={<Tags size={18} />} title="Danh mục" tone="text-violet-600 bg-violet-50">
          <List title="Chương trình" items={programs.map((p) => ({ name: p.name, color: p.color, note: `${p._count.courses} khóa` }))} />
          <List title="Môn học" items={subjects.map((x) => ({ name: x.name, note: `${x._count.classes} lớp` }))} />
          <List title="Đối tượng học viên" items={grades.map((g) => ({ name: g.name, note: `${g._count.students} học viên` }))} />
        </Card>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400"><GraduationCap size={14} /> Phần sửa trực tiếp các mục này đang được làm tiếp ở giai đoạn 1.</p>
    </>
  );
}

function Card({ icon, title, tone, children }: { icon: React.ReactNode; title: string; tone: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>{icon}</span>{title}</h2>
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
function List({ title, items }: { title: string; items: { name: string; color?: string; note: string }[] }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <span key={i.name} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-sm ring-1 ring-slate-200">
            {i.color && <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />}{i.name}<span className="text-xs text-slate-400">· {i.note}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
