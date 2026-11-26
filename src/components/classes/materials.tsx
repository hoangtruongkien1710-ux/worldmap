import { FileText, Link2, Paperclip, Trash2 } from "lucide-react";
import { ActionForm, ConfirmButton, Field, ModalButton } from "@/components/ui/modal";
import { addMaterial, deleteMaterial } from "@/lib/actions/materials";
import { MATERIAL_ACCEPT, MATERIAL_MAX_MB } from "@/lib/uploads";

type M = { id: string; title: string; url: string | null; fileName: string | null; size: number | null };

const kb = (n: number | null) => (!n ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

/** Danh sách tài liệu / giáo trình của khóa, kèm nút quản lý cho admin. */
export function MaterialsList({ items, courseId, courseName, manage, compact }: { items: M[]; courseId: string; courseName: string; manage: boolean; compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((m) => (
        <a key={m.id} href={`/tai-lieu/${m.id}`} target="_blank" rel="noopener noreferrer" title={m.fileName ?? m.url ?? ""}
          className="inline-flex max-w-[220px] items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700">
          {m.url ? <Link2 size={13} className="shrink-0" /> : <FileText size={13} className="shrink-0" />}<span className="truncate">{m.title}</span>
        </a>
      ))}
      {!items.length && !manage && <span className="text-xs text-slate-400">{compact ? "" : "Chưa có tài liệu"}</span>}
      {manage && (
        <ModalButton variant="bare" className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
          label={items.length ? "Quản lý" : "Thêm tài liệu"} icon={<Paperclip size={13} />} title={`Tài liệu · ${courseName}`} subtitle="Tải file lên hoặc gắn link (Google Drive, website…)" size="md">
          {items.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {items.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                  {m.url ? <Link2 size={16} className="shrink-0 text-slate-400" /> : <FileText size={16} className="shrink-0 text-slate-400" />}
                  <a href={`/tai-lieu/${m.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 hover:underline">
                    <div className="truncate font-semibold">{m.title}</div>
                    <div className="truncate text-xs text-slate-500">{m.url ?? `${m.fileName} · ${kb(m.size)}`}</div>
                  </a>
                  <ConfirmButton variant="bare" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" label={<Trash2 size={15} />}
                    title="Xóa tài liệu?" message={<>Xóa <b>{m.title}</b> khỏi khóa {courseName}.</>} confirmLabel="Xóa" action={deleteMaterial.bind(null, m.id)} />
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addMaterial.bind(null, courseId)} submitLabel="Thêm tài liệu">
            <Field label="Tên tài liệu" hint="Bỏ trống = lấy theo tên file"><input name="title" maxLength={120} className="input" placeholder="VD: Giáo trình HSK 1 – bài 1–5" /></Field>
            <Field label="Tải file lên" hint={`PDF, Word, Excel, PowerPoint, ảnh, mp3, zip · tối đa ${MATERIAL_MAX_MB} MB`}>
              <input type="file" name="file" accept={MATERIAL_ACCEPT} className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-brand-700" />
            </Field>
            <Field label="Hoặc gắn link"><input name="url" type="url" className="input" placeholder="https://drive.google.com/…" /></Field>
          </ActionForm>
        </ModalButton>
      )}
    </div>
  );
}
