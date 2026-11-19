"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { MoreVertical, X } from "lucide-react";

export type ActionResult = { ok: boolean; error?: string; message?: string; at?: number };
export type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

const CloseCtx = createContext<() => void>(() => {});
export const useCloseModal = () => useContext(CloseCtx);

const SIZE = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

/** Nút mở popup. Popup gắn vào body nên vẫn mở được khi nằm trong menu ⋮. */
export function ModalButton({
  label, icon, title, subtitle, size = "md", variant = "btn", children, className,
}: {
  label: React.ReactNode; icon?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode;
  size?: keyof typeof SIZE; variant?: "btn" | "primary" | "menu" | "danger-menu" | "link" | "bare"; children: React.ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const close = () => setOpen(false);
  const cls = {
    btn: "btn",
    primary: "btn btn-primary",
    menu: "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50",
    "danger-menu": "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50",
    link: "inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline",
    bare: "",
  }[variant];
  return (
    <>
      <button type="button" className={clsx(cls, className)} onClick={() => setOpen(true)}>{icon}{label}</button>
      {mounted && createPortal(
        <dialog
          ref={ref}
          onClose={close}
          onClick={(e) => { if (e.target === ref.current) close(); }}
          className={clsx("m-auto w-[calc(100%-1.5rem)] rounded-2xl bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]", SIZE[size])}
        >
          {open && (
            <CloseCtx.Provider value={close}>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h3 className="text-lg font-bold">{title}</h3>
                  {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
                </div>
                <button type="button" onClick={close} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Đóng"><X size={18} /></button>
              </div>
              <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
            </CloseCtx.Provider>
          )}
        </dialog>,
        document.body,
      )}
    </>
  );
}

/** Form trong popup: gọi server action, báo lỗi tại chỗ, thành công thì đóng popup và tải lại dữ liệu. */
export function ActionForm({
  action, children, submitLabel = "Lưu", danger, className, keepOpen,
}: { action: FormAction; children: React.ReactNode; submitLabel?: string; danger?: boolean; className?: string; keepOpen?: boolean }) {
  const [state, run, pending] = useActionState(action, { ok: false });
  const close = useCloseModal();
  const router = useRouter();
  const handled = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (state.ok && handled.current !== state) {
      handled.current = state;
      router.refresh();
      if (!keepOpen) close();
    }
  }, [state, close, router, keepOpen]);
  return (
    <form action={run} className={clsx("space-y-4", className)}>
      {children}
      {state.error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</div>}
      {state.ok && state.message && <div className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</div>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" className="btn" onClick={close}>Hủy</button>
        <button type="submit" disabled={pending} className={clsx("btn", danger ? "border-rose-600 bg-rose-600 text-white hover:bg-rose-700" : "btn-primary")}>
          {pending ? "Đang lưu…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Popup xác nhận xóa / thao tác không hoàn tác. */
export function ConfirmButton({ label, icon, title, message, action, confirmLabel = "Xóa", variant = "danger-menu" }: {
  label: React.ReactNode; icon?: React.ReactNode; title: string; message: React.ReactNode; action: FormAction; confirmLabel?: string;
  variant?: "btn" | "menu" | "danger-menu";
}) {
  return (
    <ModalButton label={label} icon={icon} title={title} size="sm" variant={variant}>
      <ActionForm action={action} submitLabel={confirmLabel} danger>
        <div className="text-sm text-slate-600">{message}</div>
      </ActionForm>
    </ModalButton>
  );
}

/** Menu ⋮ trên mỗi dòng. Các mục luôn được giữ trong DOM để popup con không bị mất khi menu đóng. */
export function RowMenu({ children, label }: { children: React.ReactNode; label?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block text-left">
      <button type="button" onClick={() => setOpen((v) => !v)} className={label ? "btn" : "rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"} aria-label="Thao tác">
        {label ?? <MoreVertical size={17} />}
      </button>
      <div onClick={() => setOpen(false)} className={clsx("absolute right-0 z-30 mt-1 w-52 rounded-xl border border-slate-100 bg-white p-1 shadow-xl", !open && "hidden")}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Ô nhập liệu dùng chung ---------- */

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return <div className={clsx("grid gap-3", cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>{children}</div>;
}
