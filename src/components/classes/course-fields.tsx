import { Field, Grid } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";

type CourseValue = {
  programId: string; code: string; name: string; level: string | null; target: string | null; description: string | null;
  sessionsMin: number | null; sessionsMax: number | null; sessionsPerWeek: string | null; durationText: string | null;
  sessionHours: unknown; listedPrice: number; priceUnit: string; classSizeMin: number | null; classSizeMax: number | null; coursebook: string | null;
};

export function CourseFields({ programs, c }: { programs: { id: string; name: string }[]; c?: CourseValue }) {
  return (
    <>
      <Grid cols={3}>
        <Field label="Chương trình">
          <select name="programId" defaultValue={c?.programId ?? programs[0]?.id} className="input">
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Mã khóa" hint={c ? "Không đổi được mã" : "VD: HSK 4"}>
          <input name="code" defaultValue={c?.code} disabled={!!c} required={!c} className="input" />
        </Field>
        <Field label="Tên khóa"><input name="name" defaultValue={c?.name} required className="input" /></Field>
      </Grid>
      <Grid>
        <Field label="Trình độ / đối tượng"><input name="level" defaultValue={c?.level ?? ""} className="input" placeholder="VD: THCS–THPT" /></Field>
        <Field label="Mục tiêu đầu ra"><input name="target" defaultValue={c?.target ?? ""} className="input" placeholder="VD: Band 5.0–5.5" /></Field>
      </Grid>
      <Field label="Mô tả"><input name="description" defaultValue={c?.description ?? ""} className="input" /></Field>
      <Grid cols={3}>
        <Field label="Học phí niêm yết (đ)"><MoneyInput name="listedPrice" defaultValue={c?.listedPrice} required label="Học phí" /></Field>
        <Field label="Tính theo">
          <select name="priceUnit" defaultValue={c?.priceUnit ?? "COURSE"} className="input">
            <option value="COURSE">Trọn khóa</option><option value="SESSION">Theo buổi (1-1)</option>
          </select>
        </Field>
        <Field label="Giờ mỗi buổi"><input name="sessionHours" defaultValue={c?.sessionHours ? String(c.sessionHours) : ""} className="input" placeholder="1.5" /></Field>
      </Grid>
      <Grid cols={3}>
        <Field label="Số buổi từ"><input name="sessionsMin" type="number" min={0} defaultValue={c?.sessionsMin ?? ""} className="input" /></Field>
        <Field label="đến"><input name="sessionsMax" type="number" min={0} defaultValue={c?.sessionsMax ?? ""} className="input" /></Field>
        <Field label="Buổi / tuần"><input name="sessionsPerWeek" defaultValue={c?.sessionsPerWeek ?? ""} className="input" placeholder="2–3" /></Field>
      </Grid>
      <Grid cols={3}>
        <Field label="Thời lượng"><input name="durationText" defaultValue={c?.durationText ?? ""} className="input" placeholder="~3 tháng" /></Field>
        <Field label="Sĩ số từ"><input name="classSizeMin" type="number" min={0} defaultValue={c?.classSizeMin ?? ""} className="input" /></Field>
        <Field label="đến"><input name="classSizeMax" type="number" min={0} defaultValue={c?.classSizeMax ?? ""} className="input" /></Field>
      </Grid>
      <Field label="Giáo trình"><input name="coursebook" defaultValue={c?.coursebook ?? ""} className="input" /></Field>
    </>
  );
}
