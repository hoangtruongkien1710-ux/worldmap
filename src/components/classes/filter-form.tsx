"use client";

import { useRef } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

/** Form lọc dạng GET: đổi dropdown là lọc ngay, không cần bấm nút. */
export function FilterForm({ action, children, resetHref, active }: { action: string; children: React.ReactNode; resetHref: string; active: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action}
      onChange={(e) => { if ((e.target as HTMLElement).tagName === "SELECT") ref.current?.requestSubmit(); }}
      // Bỏ các ô trống để đường dẫn gọn (VD: /lop-hoc?tt=tat-ca)
      onSubmit={() => { ref.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[name], select[name]").forEach((el) => { if (!el.value) el.disabled = true; }); }}
      className="card mb-5 grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {children}
      <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
        <button className="btn btn-primary flex-1">Lọc</button>
        {active && <Link href={resetHref} className="btn" aria-label="Bỏ lọc" title="Bỏ lọc"><RotateCcw size={16} /></Link>}
      </div>
    </form>
  );
}

export function FilterSelect({ label, name, value, children }: { label: string; name: string; value?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="input w-full">{children}</select>
    </label>
  );
}
