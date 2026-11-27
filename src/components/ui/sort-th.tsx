import Link from "next/link";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { SortState } from "@/lib/sort";

type Params = Record<string, string | undefined>;

/**
 * Tiêu đề cột bấm để sắp xếp: bấm lần 1 tăng dần, lần 2 giảm dần, lần 3 bỏ sắp xếp.
 * Dùng cho bảng ở trang server: trạng thái nằm trên URL (?xep=cột&chieu=tang|giam).
 */
export function SortTh({ col, label, base, params, sort, align = "left", className, rowSpan, keys = ["xep", "chieu"] }: {
  col: string; label: React.ReactNode; base: string; params: Params; sort: SortState; align?: "left" | "right" | "center"; className?: string; rowSpan?: number;
  /** Tên tham số trên URL (đổi khi một trang có hai bảng). */ keys?: [string, string];
}) {
  const [kc, kd] = keys;
  const on = sort.col === col;
  const next: Params = !on ? { [kc]: col, [kd]: "tang" } : sort.dir === "tang" ? { [kc]: col, [kd]: "giam" } : { [kc]: undefined, [kd]: undefined };
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...next, trang: undefined })) if (v) u.set(k, v);
  const Icon = !on ? ChevronsUpDown : sort.dir === "tang" ? ArrowUp : ArrowDown;
  const hint = !on ? "Sắp xếp tăng dần" : sort.dir === "tang" ? "Đang tăng dần, bấm để giảm dần" : "Đang giảm dần, bấm để bỏ sắp xếp";
  return (
    <th rowSpan={rowSpan} aria-sort={on ? (sort.dir === "tang" ? "ascending" : "descending") : "none"} className={clsx("whitespace-nowrap", align === "right" && "text-right", align === "center" && "text-center", className)}>
      <Link href={`${base}${u.size ? `?${u}` : ""}`} scroll={false} title={hint}
        className={clsx("group inline-flex items-center gap-1 rounded-md px-1 py-0.5 uppercase tracking-wide transition hover:bg-slate-200/60", on ? "text-acc-700" : "text-slate-500", align === "right" && "flex-row-reverse")}>
        {label}
        <Icon size={13} className={clsx(on ? "text-acc-600" : "text-slate-300 group-hover:text-slate-500")} />
      </Link>
    </th>
  );
}
