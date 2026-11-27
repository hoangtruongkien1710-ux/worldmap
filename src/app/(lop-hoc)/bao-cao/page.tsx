import Link from "next/link";
import clsx from "clsx";
import { BarChart3, CalendarCheck, CircleCheck, ClipboardX, GraduationCap, HandCoins, LineChart as LineIcon, Presentation, Receipt, School, UserMinus, UserPlus, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { ExcelLink, MonthNav, Trend } from "@/components/tuition/ui";
import { GroupedBars, LineChart, RateBar } from "@/components/reports/charts";
import { Phones } from "@/components/students/phones";
import { guardPage } from "@/lib/auth/session";
import { fmtDate, monthOf, todayVN } from "@/lib/dates";
import { money } from "@/lib/money";
import { monthShort } from "@/lib/tuition/month";
import { classroomReport, type ClassroomReport } from "@/lib/tuition/report";

export const metadata = { title: "Báo cáo" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "doanh-thu", label: "Doanh thu", icon: Wallet },
  { key: "chuyen-can", label: "Chuyên cần", icon: CalendarCheck },
  { key: "hoc-vien", label: "Học viên", icon: GraduationCap },
  { key: "lop-hoc", label: "Lớp học", icon: Presentation },
] as const;
type Tab = (typeof TABS)[number]["key"];

const BLUE = "#2563eb", BLUE_LIGHT = "#bfdbfe", GREEN = "#16a34a";
const pctFmt = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);
const signed = (n: number) => (n > 0 ? `+${money(n)}` : n < 0 ? `−${money(-n)}` : "0");

export default async function Page({ searchParams }: { searchParams: Promise<{ thang?: string; tab?: string }> }) {
  await guardPage("report.view");
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.thang ?? "") ? sp.thang! : monthOf(todayVN());
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "doanh-thu";
  const r = await classroomReport(month);
  const href = (o: { thang?: string; tab?: string }) => {
    const p = new URLSearchParams();
    const t = o.tab ?? tab, m = o.thang ?? sp.thang;
    if (m) p.set("thang", m);
    if (t !== "doanh-thu") p.set("tab", t);
    const s = p.toString();
    return s ? `/bao-cao?${s}` : "/bao-cao";
  };
  const mLabel = (m: string) => `${Number(m.slice(5))}/${m.slice(0, 4)}`;

  return (
    <>
      <PageHeader title="Báo cáo" subtitle={`So sánh tháng ${mLabel(month)} với tháng ${mLabel(r.prevMonth)}`}
        actions={<><MonthNav month={month} href={(m) => href({ thang: m })} /><ExcelLink href={`/bao-cao/xuat?thang=${month}`} /></>} />

      <nav className="mb-5 flex gap-2 overflow-x-auto print:hidden">
        {TABS.map((t) => (
          <Link key={t.key} href={href({ tab: t.key })} className={clsx("inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition",
            tab === t.key ? "bg-brand-600 text-white ring-brand-600 shadow-sm" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}>
            <t.icon size={16} />{t.label}
          </Link>
        ))}
      </nav>

      {tab === "doanh-thu" && <Revenue r={r} />}
      {tab === "chuyen-can" && <Attendance r={r} />}
      {tab === "hoc-vien" && <Students r={r} />}
      {tab === "lop-hoc" && <Classes r={r} />}
    </>
  );
}

function Card({ icon, label, value, prev, now, prevNum, good = true, color }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; prev: React.ReactNode; now: number; prevNum: number; good?: boolean; color: string;
}) {
  return (
    <div className="card border-l-4 p-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600">{icon}{label}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500"><span>Tháng trước: <b className="text-slate-600">{prev}</b></span><Trend now={now} prev={prevNum} good={good} /></div>
    </div>
  );
}

function Panel({ icon, title, hint, children, className }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("card p-5", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold"><span className="rounded-lg bg-brand-50 p-1.5 text-brand-600">{icon}</span>{title}</h2>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

const th = "px-3 py-2.5 text-right";
const Dot = ({ color }: { color: string }) => <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: color }} />;

function Revenue({ r }: { r: ClassroomReport }) {
  const v = r.revenue;
  const m = monthShort(r.month), p = monthShort(r.prevMonth);
  const tot = v.rows.reduce((s, x) => ({ n: s.n + x.n, due: s.due + x.due, prevDue: s.prevDue + x.prevDue, paid: s.paid + x.paid, remain: s.remain + x.remain }), { n: 0, due: 0, prevDue: 0, paid: 0, remain: 0 });
  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card color={BLUE} icon={<Receipt size={15} className="text-brand-600" />} label="Học phí phải thu" value={money(v.due)} prev={money(v.prevDue)} now={v.due} prevNum={v.prevDue} />
        <Card color={GREEN} icon={<CircleCheck size={15} className="text-emerald-600" />} label="Đã thu (theo phiếu tháng)" value={money(v.paid)} prev={money(v.prevPaid)} now={v.paid} prevNum={v.prevPaid} />
        <Card color="#0ea5e9" icon={<Wallet size={15} className="text-sky-600" />} label="Thực thu trong tháng" value={money(v.cash)} prev={money(v.prevCash)} now={v.cash} prevNum={v.prevCash} />
        <Card color="#ef4444" icon={<HandCoins size={15} className="text-rose-600" />} label="Còn nợ" value={money(v.remain)} prev={money(v.prevRemain)} now={v.remain} prevNum={v.prevRemain} good={false} />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Panel icon={<BarChart3 size={16} />} title="Học phí phải thu theo lớp" hint={`${p} và ${m}`}>
          <GroupedBars labels={v.rows.map((x) => x.name)} series={[{ name: p, color: BLUE_LIGHT, values: v.rows.map((x) => x.prevDue) }, { name: m, color: BLUE, values: v.rows.map((x) => x.due) }]} />
        </Panel>
        <Panel icon={<LineIcon size={16} />} title="12 tháng gần nhất" hint="Phải thu theo phiếu tháng · thực thu theo ngày thu tiền">
          <LineChart labels={v.trend.map((t) => monthShort(t.month))} series={[{ name: "Phải thu", color: BLUE, values: v.trend.map((t) => t.due) }, { name: "Thực thu", color: GREEN, values: v.trend.map((t) => t.cash) }]} />
        </Panel>
      </div>
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-xs font-semibold text-slate-500"><tr className="border-b border-slate-100"><th className="px-4 py-2.5 text-left">Lớp</th><th className={th}>Lượt học</th><th className={th}>Phải thu {m}</th><th className={th}>{p}</th><th className={th}>Chênh lệch</th><th className={th}>Đã thu</th><th className={th}>Còn nợ</th><th className="px-4 py-2.5 text-right">Tỉ lệ thu</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {v.rows.map((x) => (
              <tr key={x.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-semibold"><Dot color={x.color} />{x.name}</td>
                <td className={th}>{x.n}</td>
                <td className={clsx(th, "font-bold")}>{money(x.due)}</td>
                <td className={th}>{money(x.prevDue)}</td>
                <td className={clsx(th, "font-semibold", x.due - x.prevDue >= 0 ? "text-emerald-600" : "text-rose-600")}>{signed(x.due - x.prevDue)}</td>
                <td className={th}>{money(x.paid)}</td>
                <td className={clsx(th, "font-semibold text-rose-600")}>{money(x.remain)}</td>
                <td className="px-4 py-2.5 text-right">{pctFmt(x.due ? (x.paid / x.due) * 100 : null)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
            <tr><td className="px-4 py-3">Tổng</td><td className={th}>{tot.n}</td><td className={th}>{money(tot.due)}</td><td className={th}>{money(tot.prevDue)}</td><td className={clsx(th, tot.due - tot.prevDue >= 0 ? "text-emerald-600" : "text-rose-600")}>{signed(tot.due - tot.prevDue)}</td><td className={th}>{money(tot.paid)}</td><td className={th}>{money(tot.remain)}</td><td className="px-4 py-3 text-right">{tot.due ? Math.round((tot.paid / tot.due) * 100) : 0}%</td></tr>
          </tfoot>
        </table>
      </section>
    </>
  );
}

function Attendance({ r }: { r: ClassroomReport }) {
  const a = r.attendance;
  const m = monthShort(r.month), p = monthShort(r.prevMonth);
  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card color={BLUE} icon={<CalendarCheck size={15} className="text-brand-600" />} label="Buổi học đã dạy" value={a.sessions} prev={a.prevSessions} now={a.sessions} prevNum={a.prevSessions} />
        <Card color={GREEN} icon={<CircleCheck size={15} className="text-emerald-600" />} label="Tỉ lệ có mặt" value={pctFmt(a.rate)} prev={pctFmt(a.prevRate)} now={a.rate} prevNum={a.prevRate} />
        <Card color="#ef4444" icon={<UserMinus size={15} className="text-rose-600" />} label="Lượt vắng không phép" value={a.absent} prev={a.prevAbsent} now={a.absent} prevNum={a.prevAbsent} good={false} />
        <Card color="#f59e0b" icon={<ClipboardX size={15} className="text-amber-500" />} label="Buổi chưa điểm danh" value={a.unmarked} prev={a.prevUnmarked} now={a.unmarked} prevNum={a.prevUnmarked} good={false} />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-5">
        <Panel icon={<BarChart3 size={16} />} title="Tỉ lệ có mặt theo lớp (%)" hint={`${p} và ${m}`} className="xl:col-span-3">
          <GroupedBars unit="count" format={(n) => `${n.toFixed(1)}%`} labels={a.rows.map((x) => x.name)}
            series={[{ name: p, color: BLUE_LIGHT, values: a.rows.map((x) => x.prevRate ?? 0) }, { name: m, color: BLUE, values: a.rows.map((x) => x.rate ?? 0) }]} />
        </Panel>
        <Panel icon={<UserMinus size={16} />} title="Học viên cần chú ý" hint="Vắng từ 2 buổi trong tháng" className="xl:col-span-2">
          {a.watch.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Không có học viên nào vắng nhiều.</p> : (
            <ul className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto pr-1 text-sm">
              {a.watch.map((w) => (
                <li key={w.student.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0"><Link href={`/hoc-sinh/${w.student.code}`} className="font-semibold hover:underline">{w.student.fullName}</Link><Phones s={w.student} /></div>
                  <div className="whitespace-nowrap text-right text-xs"><b className="text-rose-600">{w.absent} không phép</b><div className="text-slate-500">{w.excused} có phép · {w.total} buổi</div></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-xs font-semibold text-slate-500"><tr className="border-b border-slate-100"><th className="px-4 py-2.5 text-left">Lớp</th><th className={th}>Buổi đã dạy</th><th className={th}>Lượt điểm danh</th><th className={th}>Có mặt</th><th className={th}>Có phép</th><th className={th}>Không phép</th><th className={th}>Tỉ lệ {p}</th><th className="px-4 py-2.5 text-left">Tỉ lệ {m}</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {a.rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Chưa có buổi học nào trong tháng.</td></tr>}
            {a.rows.map((x) => (
              <tr key={x.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-semibold"><Dot color={x.color} />{x.name}</td>
                <td className={th}>{x.sessions}</td><td className={th}>{x.marks}</td>
                <td className={clsx(th, "text-emerald-700")}>{x.present}</td><td className={th}>{x.excused}</td><td className={clsx(th, x.absent && "font-semibold text-rose-600")}>{x.absent}</td>
                <td className={th}>{pctFmt(x.prevRate)}</td>
                <td className="px-4 py-2.5"><div className="flex items-center gap-2"><RateBar pct={x.rate ?? 0} color={(x.rate ?? 0) < 80 ? "#f59e0b" : GREEN} /><b>{pctFmt(x.rate)}</b></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Students({ r }: { r: ClassroomReport }) {
  const s = r.students;
  const m = monthShort(r.month), p = monthShort(r.prevMonth);
  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card color={BLUE} icon={<Users size={15} className="text-brand-600" />} label="Học viên đang học" value={s.active} prev={s.prevActive} now={s.active} prevNum={s.prevActive} />
        <Card color={GREEN} icon={<UserPlus size={15} className="text-emerald-600" />} label="Học viên mới" value={s.newStudents.length} prev={s.prevNew} now={s.newStudents.length} prevNum={s.prevNew} />
        <Card color="#ef4444" icon={<UserMinus size={15} className="text-rose-600" />} label="Lượt nghỉ lớp" value={s.left.length} prev={s.prevLeft} now={s.left.length} prevNum={s.prevLeft} good={false} />
        <div className="card border-l-4 p-4" style={{ borderLeftColor: "#f59e0b" }}>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600"><HandCoins size={15} className="text-amber-500" />Học viên còn nợ học phí</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight">{s.debtors}</div>
          <Link href="/cong-no" className="mt-1 block text-xs text-brand-600 hover:underline">Xem công nợ →</Link>
        </div>
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Panel icon={<BarChart3 size={16} />} title="Học viên đang học theo khối" hint={`Cuối ${p} và cuối ${m}`}>
          <GroupedBars unit="count" format={(n) => `${n} học viên`} labels={s.grades.map((g) => g.name)}
            series={[{ name: p, color: BLUE_LIGHT, values: s.grades.map((g) => g.prev) }, { name: m, color: BLUE, values: s.grades.map((g) => g.now) }]} />
        </Panel>
        <div className="grid gap-5">
          <Panel icon={<UserPlus size={16} />} title={`Học viên mới (${s.newStudents.length})`}>
            {s.newStudents.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">Không có học viên mới trong tháng.</p> : (
              <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
                {s.newStudents.map((x) => <li key={x.id} className="flex items-center justify-between gap-3 py-2"><div><Link href={`/hoc-sinh/${x.code}`} className="font-semibold hover:underline">{x.fullName}</Link><div className="text-xs text-slate-500">{x.code}{x.grade ? ` · ${x.grade.name}` : ""}</div></div><span className="text-xs text-slate-500">vào {fmtDate(s.joinedAt(x.id))}</span></li>)}
              </ul>
            )}
          </Panel>
          <Panel icon={<UserMinus size={16} />} title={`Nghỉ lớp trong tháng (${s.left.length})`}>
            {s.left.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">Không có học viên nghỉ lớp.</p> : (
              <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
                {s.left.map((x, i) => <li key={i} className="flex items-center justify-between gap-3 py-2"><div><Link href={`/hoc-sinh/${x.student.code}`} className="font-semibold hover:underline">{x.student.fullName}</Link><div className="text-xs text-slate-500">{x.className}</div></div><span className="text-xs text-slate-500">{fmtDate(x.date)}</span></li>)}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Classes({ r }: { r: ClassroomReport }) {
  const c = r.classes;
  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card color={BLUE} icon={<School size={15} className="text-brand-600" />} label="Lớp đang mở" value={c.open} prev={c.prevOpen} now={c.open} prevNum={c.prevOpen} />
        <div className="card border-l-4 p-4" style={{ borderLeftColor: GREEN }}><div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600"><Users size={15} className="text-emerald-600" />Sĩ số trung bình</div><div className="mt-1 text-2xl font-extrabold">{c.avgSize.toFixed(1)}</div><div className="mt-1 text-xs text-slate-500">{c.full} lớp gần đầy (≥ 90% sĩ số tối đa)</div></div>
        <div className="card border-l-4 p-4" style={{ borderLeftColor: "#0ea5e9" }}><div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600"><CalendarCheck size={15} className="text-sky-600" />Buổi học trong tháng</div><div className="mt-1 text-2xl font-extrabold">{c.planned}</div><div className="mt-1 text-xs text-slate-500">{c.cancelled} buổi bị hủy</div></div>
        <div className="card border-l-4 p-4" style={{ borderLeftColor: "#8b5cf6" }}><div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600"><Presentation size={15} className="text-violet-600" />Lớp khai giảng trong tháng</div><div className="mt-1 text-2xl font-extrabold">{c.newClasses}</div><div className="mt-1 text-xs text-slate-500">Theo ngày bắt đầu lớp</div></div>
      </div>
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-xs font-semibold text-slate-500"><tr className="border-b border-slate-100"><th className="px-4 py-2.5 text-left">Lớp</th><th className="px-3 py-2.5 text-left">Giáo viên</th><th className={th}>Sĩ số</th><th className={th}>Tháng trước</th><th className={th}>Buổi (đã dạy / lịch)</th><th className="px-3 py-2.5 text-left">Chuyên cần</th><th className={th}>Phải thu</th><th className="px-4 py-2.5 text-right">Đã thu</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {c.rows.map((x) => (
              <tr key={x.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5"><Link href={`/lop-hoc/${x.code}`} className="font-semibold hover:underline"><Dot color={x.color} />{x.name}</Link>{x.status !== "OPEN" && <span className="ml-2 badge bg-slate-100 text-slate-500">đã kết thúc</span>}</td>
                <td className="px-3 py-2.5 text-slate-600">{x.teacher ?? <span className="text-slate-400">Chưa phân công</span>}</td>
                <td className={clsx(th, "font-semibold")}>{x.size}{x.max ? <span className="font-normal text-slate-400"> / {x.max}</span> : null}</td>
                <td className={th}>{x.prevSize}</td>
                <td className={th}>{x.held} / {x.planned}{x.cancelled ? <div className="text-xs text-rose-500">{x.cancelled} buổi hủy</div> : null}</td>
                <td className="px-3 py-2.5">{x.rate == null ? <span className="text-slate-400">—</span> : <div className="flex items-center gap-2"><RateBar pct={x.rate} color={x.rate < 80 ? "#f59e0b" : GREEN} />{pctFmt(x.rate)}</div>}</td>
                <td className={th}>{money(x.due)}</td>
                <td className="px-4 py-2.5 text-right">{money(x.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
