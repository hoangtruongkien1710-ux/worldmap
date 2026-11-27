import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck, HandCoins, PiggyBank, Receipt, TrendingUp, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { MonthNav, StatCard, VoucherBadge, monthLabel } from "@/components/accounting/ui";
import { PrintButton } from "@/components/accounting/print-button";
import { ActionForm, Field, ModalButton } from "@/components/ui/modal";
import { guardPage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { pickMonth } from "@/lib/accounting/queries";
import { AGE_BUCKETS, dailyCash, debtReport, expenseReport, incomeReport, payrollReport, revenueReport } from "@/lib/accounting/reports";
import { addDays, fmtDate, mondayOf, todayVN, weekday, WEEKDAY_LONG } from "@/lib/dates";
import { money } from "@/lib/money";
import { saveCashCount } from "@/lib/actions/cash";
import { MoneyInput } from "@/components/ui/money-input";

export const metadata = { title: "Báo cáo kế toán" };
export const dynamic = "force-dynamic";

type SP = { bc?: string; ngay?: string; tuan?: string; thang?: string };

const REPORTS = [
  { key: "thu-chi", label: "Thu chi", freq: "Hằng ngày", icon: Wallet },
  { key: "cong-no", label: "Công nợ", freq: "Hằng tuần", icon: HandCoins },
  { key: "doanh-thu", label: "Doanh thu", freq: "Hằng tuần", icon: TrendingUp },
  { key: "chi-phi", label: "Chi phí", freq: "Hằng tháng", icon: Receipt },
  { key: "luong", label: "Lương", freq: "Hằng tháng", icon: Users },
  { key: "kqkd", label: "Kết quả kinh doanh", freq: "Hằng tháng", icon: PiggyBank },
] as const;

const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await guardPage("accounting.view");
  const sp = await searchParams;
  const bc = REPORTS.find((r) => r.key === sp.bc)?.key ?? "thu-chi";
  const today = todayVN();
  const day = isDay(sp.ngay) ? sp.ngay! : today;
  const week = mondayOf(isDay(sp.tuan) ? sp.tuan! : today);
  const month = pickMonth(sp.thang);
  const post = can(user.role, "accounting.post");
  const cur = REPORTS.find((r) => r.key === bc)!;

  return (
    <>
      <PageHeader title="Báo cáo kế toán" subtitle={`${cur.label} · ${cur.freq.toLowerCase()} · số liệu lấy từ chứng từ và sổ cái`} actions={<PrintButton />} />
      <nav className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6 print:hidden">
        {REPORTS.map((r) => (
          <Link key={r.key} href={`/ke-toan/bao-cao?bc=${r.key}`} className={clsx("flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1 transition",
            r.key === bc ? "bg-acc-600 text-white ring-acc-600 shadow-md shadow-acc-600/25" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}>
            <r.icon size={18} className="shrink-0" />
            <span className="min-w-0"><span className="block text-sm font-semibold leading-tight">{r.label}</span><span className={clsx("text-[11px]", r.key === bc ? "text-white/75" : "text-slate-400")}>{r.freq}</span></span>
          </Link>
        ))}
      </nav>
      {bc === "thu-chi" && <DailyCash day={day} today={today} post={post} />}
      {bc === "cong-no" && <Debts day={day} today={today} />}
      {bc === "doanh-thu" && <Revenue monday={week} today={today} />}
      {bc === "chi-phi" && <Expenses month={month} />}
      {bc === "luong" && <Payroll month={sp.thang} />}
      {bc === "kqkd" && <Income month={month} />}
    </>
  );
}

/* ---------------- dùng chung ---------------- */

function StepNav({ prev, next, label, sub }: { prev: string; next?: string; label: string; sub?: string }) {
  return (
    <div className="inline-flex items-center rounded-xl bg-white ring-1 ring-slate-200 print:ring-0">
      <Link href={prev} className="rounded-l-xl p-2 text-slate-500 hover:bg-slate-50 print:hidden" aria-label="Trước"><ChevronLeft size={18} /></Link>
      <span className="min-w-40 px-2 text-center"><span className="block text-sm font-semibold">{label}</span>{sub && <span className="block text-[11px] text-slate-500">{sub}</span>}</span>
      {next ? <Link href={next} className="rounded-r-xl p-2 text-slate-500 hover:bg-slate-50 print:hidden" aria-label="Sau"><ChevronRight size={18} /></Link> : <span className="p-2 text-slate-200"><ChevronRight size={18} /></span>}
    </div>
  );
}

function Delta({ cur, prev, invert }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev) return <span className="text-xs text-slate-400">{cur ? "mới" : "—"}</span>;
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  const good = invert ? pct <= 0 : pct >= 0;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 text-xs font-semibold", pct === 0 ? "text-slate-500" : good ? "text-emerald-600" : "text-rose-600")}>
      {pct > 0 ? <ArrowUpRight size={13} /> : pct < 0 ? <ArrowDownRight size={13} /> : null}{pct > 0 ? "+" : ""}{pct}%
    </span>
  );
}

function Bar({ value, max, color = "bg-acc-500" }: { value: number; max: number; color?: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={clsx("h-full rounded-full", color)} style={{ width: `${max > 0 ? Math.min(100, (Math.max(0, value) / max) * 100) : 0}%` }} /></div>;
}

function Section({ title, sub, children, className, action }: { title: string; sub?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={clsx("card overflow-hidden break-inside-avoid", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-5">
        <div><h2 className="text-lg font-bold">{title}</h2>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>
        {action}
      </div>
      <div className="p-5 pt-3">{children}</div>
    </section>
  );
}

const TH = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const TD = "px-3 py-2.5";
const R = "whitespace-nowrap text-right";

/* ---------------- 1. Thu chi ngày ---------------- */

async function DailyCash({ day, today, post }: { day: string; today: string; post: boolean }) {
  const { rows, vouchers } = await dailyCash(day);
  const link = (d: string) => `/ke-toan/bao-cao?bc=thu-chi&ngay=${d}`;
  const t = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StepNav prev={link(addDays(day, -1))} next={day < today ? link(addDays(day, 1)) : undefined} label={`${WEEKDAY_LONG[weekday(day)]}, ${fmtDate(day)}`} sub={day === today ? "Hôm nay" : undefined} />
        <form action="/ke-toan/bao-cao" className="print:hidden"><input type="hidden" name="bc" value="thu-chi" /><input type="date" name="ngay" defaultValue={day} max={today} className="input" /></form>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard tone="emerald" icon={<ArrowDownRight size={20} />} label="Tổng thu trong ngày" value={money(t((r) => r.totalIn))} hint={`${vouchers.filter((v) => v.in).length} chứng từ thu`} />
        <StatCard tone="rose" icon={<ArrowUpRight size={20} />} label="Tổng chi trong ngày" value={money(t((r) => r.totalOut))} hint={`${vouchers.filter((v) => v.out).length} chứng từ chi`} />
        <StatCard tone="sky" icon={<Wallet size={20} />} label="Tồn cuối ngày (mọi quỹ)" value={money(t((r) => r.closing))} hint={`Đầu ngày ${money(t((r) => r.opening))}`} />
      </div>
      <Section title="Theo từng quỹ và tài khoản" sub="Tồn đầu ngày + thu − chi = tồn cuối ngày. Quỹ tiền mặt so với số đếm thực tế khi kiểm quỹ.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50"><tr><th className={TH}>Quỹ / tài khoản</th><th className={clsx(TH, "text-right")}>Tồn đầu ngày</th><th className={clsx(TH, "text-right")}>Thu</th><th className={clsx(TH, "text-right")}>Chi</th><th className={clsx(TH, "text-right")}>Tồn cuối ngày</th><th className={TH}>Kiểm quỹ</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.account.id}>
                  <td className={TD}><div className="font-semibold">{r.account.name}</div><div className="text-xs text-slate-500">{r.account.code} · TK {r.account.ledgerCode}</div></td>
                  <td className={clsx(TD, R)}>{money(r.opening)}</td>
                  <td className={clsx(TD, R, "font-semibold text-emerald-700")}>{r.totalIn ? money(r.totalIn) : "—"}</td>
                  <td className={clsx(TD, R, "font-semibold text-rose-600")}>{r.totalOut ? money(r.totalOut) : "—"}</td>
                  <td className={clsx(TD, R, "font-bold")}>{money(r.closing)}</td>
                  <td className={TD}>
                    {r.account.kind !== "CASH" ? <span className="text-xs text-slate-400">Đối chiếu sao kê</span> : (
                      <div className="flex flex-wrap items-center gap-2">
                        {r.count ? (
                          r.count.diff === 0 ? <span className="badge gap-1 bg-green-50 text-green-700"><ClipboardCheck size={13} />Khớp {money(r.count.counted)}</span>
                            : <span className="badge gap-1 bg-rose-50 text-rose-700" title={r.count.note ?? ""}><AlertTriangle size={13} />{r.count.diff > 0 ? "Thừa" : "Thiếu"} {money(Math.abs(r.count.diff))}</span>
                        ) : <span className="text-xs text-amber-600">Chưa kiểm quỹ</span>}
                        {post && (
                          <ModalButton variant="link" className="print:hidden" label={r.count ? "Sửa" : "Kiểm quỹ"} title={`Kiểm quỹ ${fmtDate(day)}`} subtitle={`${r.account.name} · tồn theo sổ ${money(r.closing)}`} size="sm">
                            <ActionForm action={saveCashCount.bind(null, r.account.id, day)}>
                              <Field label="Số tiền đếm được (đ)"><MoneyInput name="counted" required defaultValue={Math.max(0, r.count?.counted ?? r.closing)} /></Field>
                              <Field label="Ghi chú"><input name="note" defaultValue={r.count?.note ?? ""} className="input" placeholder="Lý do chênh lệch (nếu có)" /></Field>
                            </ActionForm>
                          </ModalButton>
                        )}
                      </div>
                    )}
                    {r.count?.note && <div className="mt-0.5 text-xs text-slate-500">{r.count.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Chứng từ trong ngày" className="mt-6">
        {vouchers.length === 0 ? <p className="text-sm text-slate-500">Không có chứng từ.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50"><tr><th className={TH}>Số chứng từ</th><th className={TH}>Diễn giải</th><th className={clsx(TH, "text-right")}>Thu</th><th className={clsx(TH, "text-right")}>Chi</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {vouchers.map((v) => (
                  <tr key={v.id}>
                    <td className={TD}><div className="font-semibold">{v.code}</div><VoucherBadge code={v.code} /></td>
                    <td className={TD}>{v.description}<div className="text-xs text-slate-500">{[v.label, v.counterparty].filter(Boolean).join(" · ")}</div></td>
                    <td className={clsx(TD, R, "font-semibold text-emerald-700")}>{v.in ? money(v.in) : v.transfer ? <span className="font-normal text-violet-600">{money(v.transfer)}</span> : ""}</td>
                    <td className={clsx(TD, R, "font-semibold text-rose-600")}>{v.out ? money(v.out) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

/* ---------------- 2. Công nợ ---------------- */

async function Debts({ day, today }: { day: string; today: string }) {
  const { receivable: rc, payable: pb } = await debtReport(day);
  const maxBucket = Math.max(...rc.buckets.map((b) => b.amount), 1);
  const soon = pb.suppliers.filter((p) => p.state !== "later");
  const link = (d: string) => `/ke-toan/bao-cao?bc=cong-no&ngay=${d}`;
  return (
    <>
      <div className="mb-5"><StepNav prev={link(addDays(day, -7))} next={day < today ? link(addDays(day, 7) > today ? today : addDays(day, 7)) : undefined} label={`Tính đến ${fmtDate(day)}`} sub="Báo cáo tuần" /></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="rose" icon={<HandCoins size={20} />} label="Phải thu học phí" value={money(rc.total)} hint={`${rc.debtors.length} phiếu còn nợ`} />
        <StatCard tone="amber" icon={<Receipt size={20} />} label="Phải trả nhà cung cấp" value={money(pb.supplierTotal)} hint={`${pb.suppliers.length} hóa đơn`} />
        <StatCard tone="violet" icon={<Users size={20} />} label="Lương còn phải trả" value={money(pb.salary)} hint={`BHXH ${money(pb.insurance)} · thuế TNCN ${money(pb.pit)}`} />
        <StatCard tone="orange" icon={<CalendarClock size={20} />} label="Quá hạn / đến hạn 7 ngày" value={money(soon.reduce((s, p) => s + p.remain, 0))} hint={`${soon.length} hóa đơn nhà cung cấp`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Phải thu theo tuổi nợ" sub="Tính từ ngày chốt học phí">
          <div className="space-y-3">
            {rc.buckets.map((b, i) => (
              <div key={b.key}>
                <div className="flex justify-between text-sm"><span>{b.label} <span className="text-xs text-slate-400">({b.count} phiếu)</span></span><b className={i >= 2 && b.amount ? "text-rose-600" : ""}>{money(b.amount)}</b></div>
                <Bar value={b.amount} max={maxBucket} color={["bg-emerald-400", "bg-amber-400", "bg-orange-500", "bg-rose-500"][i]} />
              </div>
            ))}
          </div>
        </Section>
        <Section title="Phải thu theo lớp">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {rc.classRows.map((r) => (
                <tr key={r.cls?.id ?? "x"}>
                  <td className="py-2"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.cls?.color }} />{r.cls ? <Link href={`/lop-hoc/${r.cls.code}?tab=cong-no`} className="font-medium hover:underline">{r.cls.name}</Link> : "Khác"}</td>
                  <td className="py-2 text-right text-xs text-slate-500">{r.students} HV</td>
                  <td className="py-2 text-right font-semibold text-rose-600">{money(r.remain)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
      <Section title="Học viên còn nợ nhiều nhất" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50"><tr><th className={TH}>Học viên</th><th className={TH}>Lớp</th><th className={TH}>Liên hệ</th><th className={clsx(TH, "text-right")}>Phải thu</th><th className={clsx(TH, "text-right")}>Đã thu</th><th className={clsx(TH, "text-right")}>Còn nợ</th><th className={clsx(TH, "text-right")}>Tuổi nợ</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rc.debtors.slice(0, 15).map((d) => (
                <tr key={d.id}>
                  <td className={TD}><Link href={`/hoc-sinh/${d.student.code}`} className="font-semibold hover:underline">{d.student.fullName}</Link><div className="text-xs text-slate-500">{d.student.code}</div></td>
                  <td className={clsx(TD, "text-slate-600")}>{d.classes}</td>
                  <td className={TD}>{d.student.parentName ?? "Học viên"}<div className="text-xs text-slate-500">{d.student.parentPhone}</div></td>
                  <td className={clsx(TD, R)}>{money(d.total)}</td>
                  <td className={clsx(TD, R, "text-emerald-700")}>{d.paid ? money(d.paid) : "—"}</td>
                  <td className={clsx(TD, R, "font-bold text-rose-600")}>{money(d.remain)}</td>
                  <td className={clsx(TD, R, d.age > 60 ? "font-semibold text-rose-600" : "text-slate-600")}>{d.age} ngày</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rc.debtors.length > 15 && <p className="mt-2 text-xs text-slate-500">Còn {rc.debtors.length - 15} phiếu khác, xem đủ ở màn Công nợ.</p>}
      </Section>
      <Section title="Phải trả nhà cung cấp" className="mt-6">
        {pb.suppliers.length === 0 ? <p className="text-sm text-slate-500">Không còn nợ nhà cung cấp.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50"><tr><th className={TH}>Hóa đơn</th><th className={TH}>Nhà cung cấp</th><th className={TH}>Hạn trả</th><th className={clsx(TH, "text-right")}>Còn nợ</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {pb.suppliers.map((p) => (
                  <tr key={p.id}>
                    <td className={TD}><div className="font-semibold">{p.code}</div><div className="text-xs text-slate-500">{p.description}</div></td>
                    <td className={TD}>{p.supplier?.name}</td>
                    <td className={TD}>
                      {fmtDate(p.dueDate)}{" "}
                      {p.state === "overdue" ? <span className="badge bg-rose-50 text-rose-700">Quá hạn {-p.dueIn} ngày</span> : p.state === "soon" ? <span className="badge bg-amber-50 text-amber-700">Còn {p.dueIn} ngày</span> : null}
                    </td>
                    <td className={clsx(TD, R, "font-bold text-rose-600")}>{money(p.remain)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

/* ---------------- 3. Doanh thu ---------------- */

async function Revenue({ monday, today }: { monday: string; today: string }) {
  const r = await revenueReport(monday);
  const link = (d: string) => `/ke-toan/bao-cao?bc=doanh-thu&tuan=${d}`;
  const max = Math.max(...r.byClass.map((c) => Math.max(c.recognized, c.collected)), 1);
  return (
    <>
      <div className="mb-5"><StepNav prev={link(addDays(monday, -7))} next={addDays(monday, 7) <= today ? link(addDays(monday, 7)) : undefined} label={`Tuần ${fmtDate(r.from).slice(0, 5)} – ${fmtDate(r.to)}`} sub={monday === mondayOf(today) ? "Tuần này" : undefined} /></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="indigo" icon={<Receipt size={20} />} label="Doanh thu học phí ghi nhận" value={money(r.cur.totalRecognized)} hint={<>Tuần trước {money(r.prev.totalRecognized)} <Delta cur={r.cur.totalRecognized} prev={r.prev.totalRecognized} /></>} />
        <StatCard tone="emerald" icon={<Wallet size={20} />} label="Thực thu học phí" value={money(r.cur.totalCollected)} hint={<>Tuần trước {money(r.prev.totalCollected)} <Delta cur={r.cur.totalCollected} prev={r.prev.totalCollected} /></>} />
        <StatCard tone="sky" icon={<ArrowDownRight size={20} />} label="Thu khác (giáo trình, phí thi…)" value={money(r.cur.otherIncome)} hint={<>Tuần trước {money(r.prev.otherIncome)} <Delta cur={r.cur.otherIncome} prev={r.prev.otherIncome} /></>} />
        <StatCard tone="violet" icon={<TrendingUp size={20} />} label="Thực thu lũy kế tháng" value={money(r.mtd.totalCollected)} hint={<>Cùng kỳ tháng trước {money(r.prevMtd.totalCollected)} <Delta cur={r.mtd.totalCollected} prev={r.prevMtd.totalCollected} /></>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Section title="Theo lớp" sub="Ghi nhận: học phí chốt trong tuần · Thực thu: tiền nhận trong tuần" className="lg:col-span-3">
          {r.byClass.length === 0 ? <p className="text-sm text-slate-500">Tuần này chưa có doanh thu học phí.</p> : (
            <div className="space-y-3">
              {r.byClass.map((c) => (
                <div key={c.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="font-medium"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span>
                    <span className="text-xs text-slate-500">Ghi nhận <b className="text-indigo-700">{money(c.recognized)}</b> · Thực thu <b className="text-emerald-700">{money(c.collected)}</b> <Delta cur={c.collected} prev={c.prevCollected} /></span>
                  </div>
                  <div className="mt-1 space-y-0.5"><Bar value={c.recognized} max={max} color="bg-indigo-400" /><Bar value={c.collected} max={max} color="bg-emerald-500" /></div>
                </div>
              ))}
            </div>
          )}
        </Section>
        <div className="space-y-6 lg:col-span-2">
          <Section title="Theo chương trình">
            <GroupTable rows={r.byProgram} />
          </Section>
          <Section title="Theo đối tượng (khối)">
            <GroupTable rows={r.byGrade} />
          </Section>
          <Section title="Hình thức thu">
            <div className="flex justify-between text-sm"><span>Chuyển khoản</span><b>{money(r.cur.transfer)}</b></div>
            <div className="flex justify-between text-sm"><span>Tiền mặt</span><b>{money(r.cur.totalCollected - r.cur.transfer)}</b></div>
          </Section>
        </div>
      </div>
    </>
  );
}

function GroupTable({ rows }: { rows: { name: string; recognized: number; collected: number }[] }) {
  if (!rows.length) return <p className="text-sm text-slate-500">Chưa có số liệu.</p>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-xs text-slate-500"><th className="pb-1 text-left font-medium" /><th className="pb-1 text-right font-medium">Ghi nhận</th><th className="pb-1 text-right font-medium">Thực thu</th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((g) => <tr key={g.name}><td className="py-1.5">{g.name}</td><td className="py-1.5 text-right">{money(g.recognized)}</td><td className="py-1.5 text-right font-semibold text-emerald-700">{money(g.collected)}</td></tr>)}
      </tbody>
    </table>
  );
}

/* ---------------- 4. Chi phí ---------------- */

async function Expenses({ month }: { month: string }) {
  const r = await expenseReport(month);
  const max = Math.max(...r.rows.map((x) => Math.max(x.amount, x.budget ?? 0)), 1);
  const over = r.rows.filter((x) => x.budget && x.amount > x.budget);
  return (
    <>
      <div className="mb-5"><MonthNav month={month} base="/ke-toan/bao-cao" params={{ bc: "chi-phi" }} /></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard tone="rose" icon={<Receipt size={20} />} label={`Tổng chi phí ${monthLabel(month).toLowerCase()}`} value={money(r.total)} hint={<>Tháng trước {money(r.prevTotal)} <Delta cur={r.total} prev={r.prevTotal} invert /></>} />
        <StatCard tone="amber" icon={<PiggyBank size={20} />} label="Ngân sách chi phí vận hành" value={money(r.budgetTotal)} hint="Không gồm lương" />
        <StatCard tone={over.length ? "orange" : "emerald"} icon={<AlertTriangle size={20} />} label="Khoản mục vượt ngân sách" value={over.length} hint={over.map((x) => x.name).join(", ") || "Không có"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Section title="Theo khoản mục" sub="Gồm phiếu chi, báo nợ và hóa đơn mua trả chậm ghi nhận trong tháng" className="lg:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50"><tr><th className={TH}>Khoản mục</th><th className={clsx(TH, "text-right")}>Tháng này</th><th className={clsx(TH, "text-right")}>Tháng trước</th><th className={clsx(TH, "text-right")}>Ngân sách</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {r.rows.map((x) => (
                  <tr key={x.code}>
                    <td className={TD}>
                      <div className="font-medium">{x.name} <span className="text-xs text-slate-400">({x.count})</span></div>
                      <div className="mt-1 w-full max-w-56"><Bar value={x.amount} max={max} color={x.budget && x.amount > x.budget ? "bg-rose-500" : "bg-orange-400"} /></div>
                    </td>
                    <td className={clsx(TD, R, "font-semibold")}>{money(x.amount)}</td>
                    <td className={clsx(TD, R)}><div className="text-slate-600">{money(x.prev)}</div><Delta cur={x.amount} prev={x.prev} invert /></td>
                    <td className={clsx(TD, R)}>{x.budget ? <><div className="text-slate-600">{money(x.budget)}</div><span className={clsx("text-xs font-semibold", x.amount > x.budget ? "text-rose-600" : "text-emerald-600")}>{Math.round((x.amount / x.budget) * 100)}%</span></> : <span className="text-slate-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 font-bold"><tr><td className={TD}>Cộng</td><td className={clsx(TD, R)}>{money(r.total)}</td><td className={clsx(TD, R)}>{money(r.prevTotal)}</td><td className={clsx(TD, R)}>{money(r.budgetTotal)}</td></tr></tfoot>
            </table>
          </div>
        </Section>
        <Section title="Các khoản chi lớn nhất" className="lg:col-span-2">
          <ol className="space-y-2.5 text-sm">
            {r.top.map((t, i) => (
              <li key={t.ref} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{t.description}</div><div className="text-xs text-slate-500">{fmtDate(t.date)} · {t.name}{t.who ? ` · ${t.who}` : ""}</div></div>
                <b className="whitespace-nowrap text-rose-600">{money(t.amount)}</b>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </>
  );
}

/* ---------------- 5. Lương ---------------- */

async function Payroll({ month }: { month?: string }) {
  const r = await payrollReport(month);
  if (!r) return <div className="card p-8 text-center text-sm text-slate-500">Chưa nhập bảng lương tháng nào.</div>;
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {r.periods.map((m) => (
          <Link key={m} href={`/ke-toan/bao-cao?bc=luong&thang=${m}`} className={clsx("rounded-xl px-4 py-2 text-sm font-semibold ring-1", m === r.period.month ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200")}>{monthLabel(m)}</Link>
        ))}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="violet" icon={<Users size={20} />} label="Tổng quỹ lương" value={money(r.totals.gross)} hint={<>{r.prevPeriod ? `${monthLabel(r.prevPeriod.month)}: ${money(r.totals.prevGross)} ` : ""}<Delta cur={r.totals.gross} prev={r.totals.prevGross} invert /></>} />
        <StatCard tone="sky" icon={<Receipt size={20} />} label="Khấu trừ BHXH + thuế TNCN" value={money(r.totals.insurance + r.totals.pit)} />
        <StatCard tone="emerald" icon={<Wallet size={20} />} label="Đã trả" value={money(r.paid)} hint={r.payTxns.map((t) => `${t.code} ngày ${fmtDate(t.date)}`).join(", ") || "Chưa trả"} />
        <StatCard tone={r.unpaid ? "rose" : "emerald"} icon={<HandCoins size={20} />} label="Còn phải trả" value={money(r.unpaid)} hint={`Thực lĩnh ${money(r.totals.net)}`} />
      </div>
      <Section title="Theo bộ phận" sub="So với tháng trước">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50"><tr><th className={TH}>Bộ phận</th><th className={clsx(TH, "text-right")}>Số người</th><th className={clsx(TH, "text-right")}>Tổng thu nhập</th><th className={clsx(TH, "text-right")}>Tháng trước</th><th className={clsx(TH, "text-right")}>Khấu trừ</th><th className={clsx(TH, "text-right")}>Thực lĩnh</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {r.depts.map((d) => (
                <tr key={d.key}>
                  <td className={TD}><div className="font-semibold">{d.label}</div>{d.cur.sessions > 0 && <div className="text-xs text-slate-500">{d.cur.sessions} buổi dạy</div>}</td>
                  <td className={clsx(TD, R)}>{d.cur.count}</td>
                  <td className={clsx(TD, R, "font-semibold")}>{money(d.cur.gross)}</td>
                  <td className={clsx(TD, R)}><div className="text-slate-600">{money(d.prev.gross)}</div><Delta cur={d.cur.gross} prev={d.prev.gross} invert /></td>
                  <td className={clsx(TD, R)}>{money(d.cur.insurance + d.cur.pit)}</td>
                  <td className={clsx(TD, R, "font-bold")}>{money(d.cur.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Chi tiết từng người" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50"><tr><th className={TH}>Nhân sự</th><th className={clsx(TH, "text-right")}>Công / buổi</th><th className={clsx(TH, "text-right")}>Tổng thu nhập</th><th className={clsx(TH, "text-right")}>BHXH</th><th className={clsx(TH, "text-right")}>Thuế TNCN</th><th className={clsx(TH, "text-right")}>Thực lĩnh</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {r.lines.map((l) => (
                <tr key={l.id}>
                  <td className={TD}><div className="font-semibold">{l.employee.fullName}</div><div className="text-xs text-slate-500">{l.employee.code} · {l.employee.position}</div></td>
                  <td className={clsx(TD, R, "text-slate-600")}>{l.teachingSessions !== null ? `${l.teachingSessions} buổi` : `${String(l.workDays)} công`}</td>
                  <td className={clsx(TD, R)}>{money(r.gross(l))}</td>
                  <td className={clsx(TD, R)}>{l.insurance ? money(l.insurance) : "—"}</td>
                  <td className={clsx(TD, R)}>{l.pit ? money(l.pit) : "—"}</td>
                  <td className={clsx(TD, R, "font-bold")}>{money(l.netPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

/* ---------------- 6. Kết quả kinh doanh ---------------- */

async function Income({ month }: { month: string }) {
  const { cur, prev, ytd, series } = await incomeReport(month);
  const gross = (p: typeof ytd) => p.totalRevenue - p.expenses.teaching;
  const rows: { label: string; f: (p: typeof ytd) => number; bold?: boolean; indent?: boolean; cost?: boolean }[] = [
    { label: "Doanh thu học phí", f: (p) => p.revenue.tuition, indent: true },
    { label: "Doanh thu khác (giáo trình, phí thi, thu khác)", f: (p) => p.revenue.other, indent: true },
    { label: "Tổng doanh thu", f: (p) => p.totalRevenue, bold: true },
    { label: "Giá vốn: lương giáo viên, giáo trình", f: (p) => p.expenses.teaching, indent: true, cost: true },
    { label: "Lợi nhuận gộp", f: gross, bold: true },
    { label: "Chi phí bán hàng (marketing)", f: (p) => p.expenses.marketing, indent: true, cost: true },
    { label: "Chi phí quản lý (thuê nhà, điện nước, lương văn phòng…)", f: (p) => p.expenses.admin, indent: true, cost: true },
    { label: "Chi phí khác", f: (p) => p.expenses.other, indent: true, cost: true },
    { label: "Lợi nhuận", f: (p) => p.profit, bold: true },
  ];
  const max = Math.max(...series.map((s) => Math.max(s.totalRevenue, s.totalExpense)), 1);
  const margin = cur.totalRevenue ? Math.round((cur.profit / cur.totalRevenue) * 100) : 0;
  return (
    <>
      <div className="mb-5"><MonthNav month={month} base="/ke-toan/bao-cao" params={{ bc: "kqkd" }} /></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="indigo" icon={<TrendingUp size={20} />} label="Doanh thu" value={money(cur.totalRevenue)} hint={<>{prev ? `Tháng trước ${money(prev.totalRevenue)} ` : ""}<Delta cur={cur.totalRevenue} prev={prev?.totalRevenue ?? 0} /></>} />
        <StatCard tone="rose" icon={<Receipt size={20} />} label="Chi phí" value={money(cur.totalExpense)} hint={<>{prev ? `Tháng trước ${money(prev.totalExpense)} ` : ""}<Delta cur={cur.totalExpense} prev={prev?.totalExpense ?? 0} invert /></>} />
        <StatCard tone={cur.profit >= 0 ? "emerald" : "rose"} icon={<PiggyBank size={20} />} label="Lợi nhuận tháng" value={money(cur.profit)} hint={`Biên lợi nhuận ${margin}%`} />
        <StatCard tone="violet" icon={<Wallet size={20} />} label={`Lợi nhuận lũy kế ${month.slice(0, 4)}`} value={money(ytd.profit)} hint={`Doanh thu ${money(ytd.totalRevenue)}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Section title="Báo cáo kết quả kinh doanh" sub="Theo sổ cái: doanh thu ghi nhận khi chốt học phí, chi phí theo bút toán" className="lg:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50"><tr><th className={TH}>Chỉ tiêu</th><th className={clsx(TH, "text-right")}>{monthLabel(month)}</th><th className={clsx(TH, "text-right")}>Tháng trước</th><th className={clsx(TH, "text-right")}>Lũy kế năm</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((x) => (
                  <tr key={x.label} className={x.bold ? "bg-slate-50/70 font-bold" : ""}>
                    <td className={clsx(TD, x.indent && "pl-6 text-slate-600")}>{x.cost ? "− " : ""}{x.label}</td>
                    <td className={clsx(TD, R, x.label === "Lợi nhuận" && (x.f(cur) >= 0 ? "text-emerald-700" : "text-rose-600"))}>{money(x.f(cur))}</td>
                    <td className={clsx(TD, R, "text-slate-600")}>{prev ? money(x.f(prev)) : "—"}</td>
                    <td className={clsx(TD, R)}>{money(x.f(ytd))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="Theo tháng" sub="Doanh thu, chi phí và lợi nhuận" className="lg:col-span-2">
          <div className="flex h-56 items-end gap-4 border-b border-slate-200 px-1">
            {series.map((s) => (
              <div key={s.month} className="flex h-full flex-1 flex-col justify-end">
                <div className="mb-1 text-center text-[11px] font-semibold text-slate-600">{Math.round(s.profit / 1_000_000)} tr</div>
                <div className="flex h-full items-end justify-center gap-1">
                  <div className="w-1/3 rounded-t bg-indigo-500" style={{ height: `${(s.totalRevenue / max) * 100}%` }} title={`Doanh thu ${money(s.totalRevenue)}`} />
                  <div className="w-1/3 rounded-t bg-rose-400" style={{ height: `${(s.totalExpense / max) * 100}%` }} title={`Chi phí ${money(s.totalExpense)}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-4 px-1">{series.map((s) => <div key={s.month} className="flex-1 text-center text-xs text-slate-500">T{Number(s.month.slice(5))}</div>)}</div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />Doanh thu</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />Chi phí</span>
            <span>Số trên cột: lợi nhuận (triệu đồng)</span>
          </div>
          <p className="mt-3 text-xs text-slate-400">Bắt đầu dùng phần mềm từ 01/09/2026 nên chưa có số liệu các tháng trước.</p>
        </Section>
      </div>
    </>
  );
}
