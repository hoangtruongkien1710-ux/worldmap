import { Field, Grid } from "@/components/ui/modal";
import { money } from "@/lib/money";
import { todayVN, toDay, WEEKDAY_LONG } from "@/lib/dates";
import { MoneyInput } from "@/components/ui/money-input";

export type ClassOptions = {
  courses: { id: string; code: string; name: string; listedPrice: number; priceUnit: string; program: { name: string } }[];
  teachers: { id: string; fullName: string }[];
  rooms: { id: number; name: string }[];
  grades: { id: number; name: string }[];
};

type ClassValue = {
  code: string; name: string; courseId: string | null; teacherId: string | null; roomId: number | null; gradeId: number | null;
  color: string; startDate: Date; totalSessions: number | null; maxStudents: number | null; unitPrice: number;
  schedules: { weekday: number; startTime: string; endTime: string }[];
};

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function ClassFields({ o, c }: { o: ClassOptions; c?: ClassValue }) {
  return (
    <>
      <Grid>
        <Field label="Mã lớp" hint={c ? "Không đổi được mã lớp" : "VD: HSK1-2612"}>
          <input name="code" defaultValue={c?.code} disabled={!!c} required={!c} className="input uppercase" />
        </Field>
        <Field label="Tên lớp"><input name="name" defaultValue={c?.name} required className="input" placeholder="VD: HSK 1 – K2612" /></Field>
      </Grid>
      <Field label="Khóa học" hint="Lớp theo buổi (IELTS 1-1) tính tiền theo số buổi đã học">
        <select name="courseId" defaultValue={c?.courseId ?? ""} required className="input">
          <option value="" disabled>Chọn khóa học</option>
          {o.courses.map((k) => <option key={k.id} value={k.id}>{k.program.name} · {k.name} · {money(k.listedPrice)}/{k.priceUnit === "SESSION" ? "buổi" : "khóa"}</option>)}
        </select>
      </Field>
      <Grid cols={3}>
        <Field label="Giáo viên">
          <select name="teacherId" defaultValue={c?.teacherId ?? ""} className="input">
            <option value="">Chưa phân công</option>
            {o.teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </select>
        </Field>
        <Field label="Phòng">
          <select name="roomId" defaultValue={c?.roomId ?? ""} className="input">
            <option value="">—</option>
            {o.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Đối tượng">
          <select name="gradeId" defaultValue={c?.gradeId ?? ""} className="input">
            <option value="">—</option>
            {o.grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
      </Grid>
      <Grid cols={3}>
        <Field label="Khai giảng"><input type="date" name="startDate" defaultValue={c ? toDay(c.startDate) : todayVN()} required className="input" /></Field>
        <Field label="Số buổi của khóa" hint="Bỏ trống nếu học theo buổi"><input type="number" min={1} name="totalSessions" defaultValue={c?.totalSessions ?? ""} className="input" /></Field>
        <Field label="Sĩ số tối đa"><input type="number" min={1} name="maxStudents" defaultValue={c?.maxStudents ?? ""} className="input" /></Field>
      </Grid>
      <Grid>
        <Field label="Học phí (đ)" hint="Bỏ trống = giá niêm yết của khóa"><MoneyInput name="unitPrice" defaultValue={c?.unitPrice} label="Học phí" /></Field>
        <Field label="Màu lớp" hint="Bỏ trống = màu chương trình"><input type="color" name="color" defaultValue={c?.color ?? "#2463eb"} className="input h-[42px] p-1" /></Field>
      </Grid>
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700">Lịch học cố định</div>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {ORDER.map((wd) => {
            const r = c?.schedules.find((s) => s.weekday === wd);
            return (
              <div key={wd} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <label className="flex w-28 items-center gap-2 font-medium"><input type="checkbox" name={`wd${wd}`} defaultChecked={!!r} className="h-4 w-4 accent-brand-500" />{WEEKDAY_LONG[wd]}</label>
                <input type="time" name={`s${wd}`} defaultValue={r?.startTime ?? "18:00"} className="input w-28 py-1.5" />
                <span className="text-slate-400">–</span>
                <input type="time" name={`e${wd}`} defaultValue={r?.endTime ?? "19:30"} className="input w-28 py-1.5" />
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-slate-400">Đổi lịch chỉ áp dụng từ hôm nay; các buổi đã điểm danh được giữ nguyên.</p>
      </div>
    </>
  );
}

type StudentValue = { fullName: string; gradeId: number | null; school: string | null; phone?: string | null; parentName: string | null; parentRelation: string | null; parentPhone: string | null; note: string | null; status?: string };

export function StudentFields({ grades, s, withStatus }: { grades: { id: number; name: string }[]; s?: StudentValue; withStatus?: boolean }) {
  return (
    <>
      <Grid>
        <Field label="Họ tên học viên"><input name="fullName" defaultValue={s?.fullName} required maxLength={60} className="input" /></Field>
        <Field label="Đối tượng">
          <select name="gradeId" defaultValue={s?.gradeId ?? ""} className="input">
            <option value="">—</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
      </Grid>
      <Grid>
        <Field label="Trường / nơi làm việc"><input name="school" defaultValue={s?.school ?? ""} className="input" /></Field>
        <Field label="SĐT học viên" hint="Số của chính học viên (nếu có)"><input name="phone" defaultValue={s?.phone ?? ""} inputMode="tel" className="input" placeholder="09…" /></Field>
      </Grid>
      <Grid cols={3}>
        <Field label="Phụ huynh / người liên hệ"><input name="parentName" defaultValue={s?.parentName ?? ""} className="input" placeholder="VD: Chị Lan" /></Field>
        <Field label="Quan hệ">
          <select name="parentRelation" defaultValue={s?.parentRelation ?? ""} className="input">
            <option value="">—</option><option value="mẹ">Mẹ</option><option value="bố">Bố</option><option value="khác">Khác</option>
          </select>
        </Field>
        <Field label="SĐT phụ huynh"><input name="parentPhone" defaultValue={s?.parentPhone ?? ""} inputMode="tel" className="input" placeholder="09…" /></Field>
      </Grid>
      <Field label="Ghi chú"><textarea name="note" defaultValue={s?.note ?? ""} rows={2} className="input" /></Field>
      {withStatus && (
        <Field label="Trạng thái">
          <select name="status" defaultValue={s?.status ?? "ACTIVE"} className="input"><option value="ACTIVE">Đang học</option><option value="INACTIVE">Đã nghỉ</option></select>
        </Field>
      )}
    </>
  );
}
