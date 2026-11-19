import clsx from "clsx";

type P = { phone?: string | null; parentPhone?: string | null };

/** Số điện thoại học viên (HV) và phụ huynh (PH), bấm để gọi. */
export function Phones({ s, className }: { s: P; className?: string }) {
  if (!s.phone && !s.parentPhone) return null;
  return (
    <div className={clsx("flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500", className)}>
      {s.parentPhone && <a href={`tel:${s.parentPhone}`} className="whitespace-nowrap hover:text-brand-600 hover:underline"><span className="font-semibold text-slate-400">PH</span> {s.parentPhone}</a>}
      {s.phone && <a href={`tel:${s.phone}`} className="whitespace-nowrap hover:text-brand-600 hover:underline"><span className="font-semibold text-slate-400">HV</span> {s.phone}</a>}
    </div>
  );
}
