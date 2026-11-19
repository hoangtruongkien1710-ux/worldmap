import { ActionForm, Field, Grid } from "@/components/ui/modal";
import { addSession, cancelSession } from "@/lib/actions/sessions";
import { todayVN } from "@/lib/dates";

export function AddSessionForm({ classId, defaultStart = "18:00", defaultEnd = "19:30", date }: { classId: string; defaultStart?: string; defaultEnd?: string; date?: string }) {
  return (
    <ActionForm action={addSession.bind(null, classId)} submitLabel="Thêm buổi">
      <Field label="Loại buổi">
        <select name="source" className="input" defaultValue="MAKEUP">
          <option value="MAKEUP">Học bù (bù cho buổi đã nghỉ)</option>
          <option value="MANUAL">Buổi thêm (thi thử, ôn tập…)</option>
        </select>
      </Field>
      <Grid cols={3}>
        <Field label="Ngày"><input type="date" name="date" defaultValue={date ?? todayVN()} required className="input" /></Field>
        <Field label="Bắt đầu"><input type="time" name="startTime" defaultValue={defaultStart} required className="input" /></Field>
        <Field label="Kết thúc"><input type="time" name="endTime" defaultValue={defaultEnd} required className="input" /></Field>
      </Grid>
      <Field label="Ghi chú / nội dung"><input name="taughtContent" className="input" placeholder="VD: Học bù buổi 12/11" /></Field>
    </ActionForm>
  );
}

export function CancelSessionForm({ sessionId, hasAttendance }: { sessionId: string; hasAttendance: boolean }) {
  return (
    <ActionForm action={cancelSession.bind(null, sessionId)} submitLabel="Cho nghỉ" danger>
      <Field label="Lý do nghỉ">
        <input name="cancelReason" required className="input" list="ly-do-nghi" placeholder="VD: Giáo viên ốm – sẽ học bù" />
        <datalist id="ly-do-nghi">
          <option value="Giáo viên ốm – sẽ học bù" /><option value="Nghỉ lễ" /><option value="Phòng học sửa chữa" /><option value="Học viên thi học kỳ" />
        </datalist>
      </Field>
      {hasAttendance && (
        <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <input type="checkbox" name="confirmClear" className="mt-0.5" /> Buổi này đã có điểm danh. Tôi đồng ý xóa điểm danh của buổi này.
        </label>
      )}
    </ActionForm>
  );
}
