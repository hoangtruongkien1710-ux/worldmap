import Link from "next/link";
import clsx from "clsx";
import { PageHeader } from "@/components/layout/app-shell";
import { SummaryStrip, Tabs } from "@/components/accounting/ui";
import { PeriodBar, SearchForm, qs } from "@/components/accounting/period-bar";
import { SortTh } from "@/components/ui/sort-th";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/auth/session";
import { ledgerSums, prevDay } from "@/lib/accounting/queries";
import { pickPeriod, type PeriodSP } from "@/lib/accounting/period";
import { parseSort, sortRows } from "@/lib/sort";
import { money } from "@/lib/money";

export const metadata = { title: "Tổng hợp" };
export const dynamic = "force-dynamic";

type SP = PeriodSP & { q?: string; loai?: string; xep?: string; chieu?: string };
const BASE = "/ke-toan/tong-hop";
const TYPES: Record<string, { label: string; cls: string }> = {
  ASSET: { label: "Tài sản", cls: "bg-sky-50 text-sky-700" },
  LIABILITY: { label: "Nợ phải trả", cls: "bg-orange-50 text-orange-700" },
  EQUITY: { label: "Vốn", cls: "bg-violet-50 text-violet-700" },
  REVENUE: { label: "Doanh thu", cls: "bg-emerald-50 text-emerald-700" },
  EXPENSE: { label: "Chi phí", cls: "bg-rose-50 text-rose-700" },
};

/** Mỗi tài khoản dẫn tới sổ / màn nghiệp vụ tương ứng, giữ nguyên khoảng thời gian đang xem. */
function target(code: string, p: { key: string; month?: string; from: string; to: string }) {
  const t = { ky: "tuychon", tu: p.from, den: p.to };
  if (code.startsWith("111")) return { href: `/ke-toan/quy${qs(t)}`, label: "Sổ quỹ" };
  if (code.startsWith("112")) return { href: `/ke-toan/ngan-hang${qs(t)}`, label: "Sổ ngân hàng" };
  if (code.startsWith("131") || code.startsWith("511")) return { href: `/ke-toan/hoc-phi${qs({ ...t, tt: code.startsWith("131") ? "con-no" : undefined })}`, label: "Học phí" };
  if (code.startsWith("331") || code.startsWith("6") || code.startsWith("811")) return { href: `/ke-toan/chi-phi${qs(t)}`, label: "Chi phí" };
  if (code.startsWith("334") || code.startsWith("338")) return { href: "/ke-toan/tien-luong", label: "Tiền lương" };
  return null;
}

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  await guardPage("accounting.view");
  const sp = await searchParams;
  const period = pickPeriod(sp);
  const { from, to } = period;
  const [accounts, before, during] = await Promise.all([
    db.ledgerAccount.findMany({ orderBy: { code: "asc" } }),
    ledgerSums(null, prevDay(from)),
    ledgerSums(from, to),
  ]);
  const z = { debit: 0, credit: 0 };
  // Chỉ hiện tài khoản chi tiết (không có tài khoản con) và có số liệu.
  const leaves = accounts.filter((a) => !accounts.some((c) => c.parentCode === a.code));
  const all = leaves.map((a) => {
    const o = before.get(a.code) ?? z;
    const p = during.get(a.code) ?? z;
    const open = o.debit - o.credit;
    const close = open + p.debit - p.credit;
    return { ...a, open, pDebit: p.debit, pCredit: p.credit, close };
  }).filter((r) => r.open || r.pDebit || r.pCredit || r.close);
  const tot = (rows: typeof all, f: (r: (typeof all)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const balanced = tot(all, (r) => r.pDebit) === tot(all, (r) => r.pCredit) && tot(all, (r) => r.close) === 0;

  const q = sp.q?.trim().toLowerCase();
  const loai = sp.loai && TYPES[sp.loai] ? sp.loai : "";
  const filtered = all.filter((r) => (!loai || r.type === loai) && (!q || r.code.includes(q) || r.name.toLowerCase().includes(q)));
  const sort = parseSort(sp, ["tk", "ten", "odn", "odc", "pn", "pc", "cdn", "cdc"]);
  const rows = sortRows(filtered, sort, {
    tk: (r) => r.code, ten: (r) => r.name, odn: (r) => Math.max(0, r.open), odc: (r) => Math.max(0, -r.open),
    pn: (r) => r.pDebit, pc: (r) => r.pCredit, cdn: (r) => Math.max(0, r.close), cdc: (r) => Math.max(0, -r.close),
  });
  const side = (v: number, want: "D" | "C") => (want === "D" ? (v > 0 ? money(v) : "") : v < 0 ? money(-v) : "");
  const cell = (v: number, want: "D" | "C") => side(v, want) || <span className="text-slate-300">—</span>;
  const th = (col: string, label: string, cls = "") => <SortTh col={col} label={label} base={BASE} params={sp} sort={sort} align="right" className={clsx("px-3 py-2", cls)} />;

  return (
    <>
      <PageHeader title="Bảng cân đối số phát sinh" subtitle={`${period.label} · lấy từ sổ nhật ký chung (bút toán kép)`} />
      <PeriodBar base={BASE} period={period} params={sp} />
      <SummaryStrip items={[
        { label: "Phát sinh Nợ", value: money(tot(all, (r) => r.pDebit)), tone: "sky" },
        { label: "Phát sinh Có", value: money(tot(all, (r) => r.pCredit)), tone: "rose" },
        { label: "Số dư cuối kỳ (Nợ)", value: money(tot(all, (r) => Math.max(0, r.close))) },
        { label: "Tình trạng sổ", value: balanced ? "Cân" : "Lệch", tone: balanced ? "emerald" : "rose", hint: balanced ? "Tổng Nợ = tổng Có" : "Cần kiểm tra bút toán" },
      ]} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={[{ k: "", l: "Tất cả" }, ...Object.entries(TYPES).map(([k, v]) => ({ k, l: v.label }))].map((t) => ({ href: `${BASE}${qs(sp, { loai: t.k || undefined })}`, label: t.l, active: loai === t.k }))} />
        <SearchForm base={BASE} params={sp} placeholder="Mã hoặc tên tài khoản" />
      </div>
      <div className="card overflow-hidden">
        <div className="max-h-[72vh] overflow-auto">
          <table className="w-full min-w-[1000px] table-fixed border-separate border-spacing-0 text-sm">
            <colgroup><col className="w-20" /><col className="w-[176px]" />{Array.from({ length: 6 }, (_, i) => <col key={i} className="w-[120px]" />)}</colgroup>
            <thead className="sticky top-0 z-10 text-xs">
              <tr className="text-center font-bold uppercase tracking-wide">
                <SortTh col="tk" label="TK" base={BASE} params={sp} sort={sort} rowSpan={2} className="border-b border-slate-200 bg-slate-50 px-4 py-2" />
                <SortTh col="ten" label="Tên tài khoản" base={BASE} params={sp} sort={sort} rowSpan={2} className="border-b border-slate-200 bg-slate-50 px-3 py-2" />
                <th colSpan={2} className="border-x border-slate-200 bg-slate-100 px-3 py-2 text-slate-600">Số dư đầu kỳ</th>
                <th colSpan={2} className="border-r border-slate-200 bg-sky-50 px-3 py-2 text-sky-700">Phát sinh trong kỳ</th>
                <th colSpan={2} className="bg-emerald-50 px-3 py-2 text-emerald-700">Số dư cuối kỳ</th>
              </tr>
              <tr className="[&>th]:border-b [&>th]:border-slate-200">
                {th("odn", "Nợ", "border-l bg-slate-100")}{th("odc", "Có", "bg-slate-100")}
                {th("pn", "Nợ", "border-l bg-sky-50")}{th("pc", "Có", "bg-sky-50")}
                {th("cdn", "Nợ", "border-l bg-emerald-50")}{th("cdc", "Có", "bg-emerald-50")}
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-slate-50/50 [&>tr>td]:border-b [&>tr>td]:border-slate-100">
              {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Không có tài khoản phù hợp.</td></tr>}
              {rows.map((r) => {
                const go = target(r.code, period);
                return (
                  <tr key={r.code} className="hover:bg-acc-50/40">
                    <td className="px-4 py-2.5 font-bold tabular-nums">{go ? <Link href={go.href} title={`Mở ${go.label}`} className="text-acc-700 hover:underline">{r.code}</Link> : r.code}</td>
                    <td className="px-3 py-2.5">
                      <div>{r.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5"><span className={`badge whitespace-nowrap !py-0 ${TYPES[r.type]?.cls ?? ""}`}>{TYPES[r.type]?.label}</span>{go && <Link href={go.href} className="text-xs font-semibold text-acc-700 hover:underline">{go.label} →</Link>}</div>
                    </td>
                    <td className="whitespace-nowrap border-l !border-l-slate-100 bg-slate-50/60 px-3 py-2.5 text-right tabular-nums">{cell(r.open, "D")}</td>
                    <td className="whitespace-nowrap bg-slate-50/60 px-3 py-2.5 text-right tabular-nums">{cell(r.open, "C")}</td>
                    <td className="whitespace-nowrap border-l !border-l-slate-100 bg-sky-50/40 px-3 py-2.5 text-right tabular-nums text-sky-700">{r.pDebit ? money(r.pDebit) : <span className="text-slate-300">—</span>}</td>
                    <td className="whitespace-nowrap bg-sky-50/40 px-3 py-2.5 text-right tabular-nums text-orange-700">{r.pCredit ? money(r.pCredit) : <span className="text-slate-300">—</span>}</td>
                    <td className="whitespace-nowrap border-l !border-l-slate-100 bg-emerald-50/40 px-3 py-2.5 text-right font-semibold tabular-nums">{cell(r.close, "D")}</td>
                    <td className="whitespace-nowrap bg-emerald-50/40 px-3 py-2.5 text-right font-semibold tabular-nums">{cell(r.close, "C")}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 font-bold [&>tr>td]:border-t-2 [&>tr>td]:border-slate-300 [&>tr>td]:bg-slate-100">
              <tr>
                <td className="px-4 py-3" colSpan={2}>Cộng {(q || loai) && <span className="text-xs font-medium text-slate-500">(theo bộ lọc)</span>}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(tot(rows, (r) => Math.max(0, r.open)))}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(tot(rows, (r) => Math.max(0, -r.open)))}</td>
                <td className="px-3 py-3 text-right tabular-nums text-sky-700">{money(tot(rows, (r) => r.pDebit))}</td>
                <td className="px-3 py-3 text-right tabular-nums text-orange-700">{money(tot(rows, (r) => r.pCredit))}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(tot(rows, (r) => Math.max(0, r.close)))}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(tot(rows, (r) => Math.max(0, -r.close)))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Bấm mã tài khoản để mở sổ hoặc màn nghiệp vụ tương ứng. Chưa kết chuyển cuối kỳ sang TK 911; doanh thu, chi phí đang để lũy kế từ 01/09/2026.</p>
    </>
  );
}
