import { Field, Grid } from "@/components/ui/modal";
import { todayVN } from "@/lib/dates";

/** Chọn lớp + ngày vào học + ưu đãi. `optional`: có thể để trống (chưa xếp lớp). */
export function EnrollFields({ classes, optional }: { classes: { id: string; code: string; name: string }[]; optional?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <Grid cols={3}>
        <Field label={optional ? "Ghi danh vào lớp (nếu có)" : "Lớp"}>
          <select name="classId" defaultValue="" required={!optional} className="input">
            <option value="" disabled={!optional}>{optional ? "Chưa xếp lớp" : "Chọn lớp"}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </Field>
        <Field label="Ngày vào học"><input type="date" name="joinDate" defaultValue={todayVN()} className="input" /></Field>
        <Field label="Ưu đãi (%)"><input type="number" name="percentDiscount" min={0} max={100} defaultValue={0} className="input" /></Field>
      </Grid>
    </div>
  );
}
