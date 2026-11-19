import { money } from "@/lib/money";

/** Làm tròn trục: 0, 5 tr, 10 tr… */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = [1, 2, 2.5, 5, 10].find((x) => x * p >= v)!;
  return m * p;
}
const axis = (v: number) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)} tr` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));

type Series = { name: string; color: string; values: number[] };

function Legend({ series }: { series: Series[] }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-slate-600">
      {series.map((s) => <span key={s.name} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.name}</span>)}
    </div>
  );
}

/** Cột nhóm: mỗi nhãn có một cột cho từng chuỗi (VD: tháng trước / tháng này). Rê chuột để xem số. */
export function GroupedBars({ labels, series, format = money, unit = "money" }: { labels: string[]; series: Series[]; format?: (n: number) => string; unit?: "money" | "count" }) {
  const W = 640, H = 260, L = 44, B = 36, T = 10;
  const max = 4 * niceMax(Math.max(0, ...series.flatMap((s) => s.values)) / 4);
  const band = (W - L - 8) / Math.max(1, labels.length);
  const bw = Math.min(26, (band * 0.7) / series.length);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  if (!labels.length) return <p className="py-10 text-center text-sm text-slate-400">Chưa có số liệu.</p>;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - 4} y1={y(t)} y2={y(t)} stroke="#eef2f7" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{unit === "money" ? axis(t) : Math.round(t)}</text></g>)}
        {labels.map((lab, i) => {
          const x0 = L + band * i + (band - bw * series.length - 2 * (series.length - 1)) / 2;
          return (
            <g key={lab}>
              <title>{`${lab}\n${series.map((s) => `${s.name}: ${format(s.values[i])}`).join("\n")}`}</title>
              <rect x={L + band * i} y={T} width={band} height={H - T - B} fill="transparent" className="hover:fill-slate-100/60" />
              {series.map((s, k) => {
                const v = s.values[i], top = y(v), h = Math.max(0, H - B - top);
                return <path key={s.name} d={h > 0 ? `M${x0 + k * (bw + 2)},${H - B} v${-(h - Math.min(4, h))} q0,-${Math.min(4, h)} ${Math.min(4, bw / 2)},-${Math.min(4, h)} h${bw - 2 * Math.min(4, bw / 2)} q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, h)} v${h - Math.min(4, h)} z` : ""} fill={s.color} />;
              })}
              <text x={L + band * i + band / 2} y={H - B + 16} textAnchor="middle" fontSize="10.5" fill="#64748b">{lab.length > Math.floor(band / 6.2) ? `${lab.slice(0, Math.max(3, Math.floor(band / 6.2) - 1))}…` : lab}</text>
            </g>
          );
        })}
        <line x1={L} x2={W - 4} y1={H - B} y2={H - B} stroke="#cbd5e1" />
      </svg>
      <Legend series={series} />
    </div>
  );
}

/** Đường nhiều chuỗi theo thời gian, cột trong suốt để rê chuột xem từng tháng. */
export function LineChart({ labels, series, format = money }: { labels: string[]; series: Series[]; format?: (n: number) => string }) {
  const W = 640, H = 260, L = 44, B = 36, T = 10, R = 22;
  const max = 4 * niceMax(Math.max(0, ...series.flatMap((s) => s.values)) / 4);
  const step = (W - L - R) / Math.max(1, labels.length - 1);
  const x = (i: number) => L + step * i;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#eef2f7" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{axis(t)}</text></g>)}
        {series.map((s, k) => (
          <g key={s.name}>
            {k === 0 && <path d={`M${x(0)},${H - B} ${s.values.map((v, i) => `L${x(i)},${y(v)}`).join(" ")} L${x(s.values.length - 1)},${H - B} Z`} fill={s.color} opacity="0.08" />}
            <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            {s.values.map((v, i) => v > 0 && <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={s.color} stroke="#fff" strokeWidth="2" />)}
          </g>
        ))}
        {labels.map((lab, i) => (
          <g key={lab} className="group">
            <title>{`${lab}\n${series.map((s) => `${s.name}: ${format(s.values[i])}`).join("\n")}`}</title>
            <rect x={x(i) - step / 2} y={T} width={step} height={H - T - B} fill="transparent" />
            <line x1={x(i)} x2={x(i)} y1={T} y2={H - B} stroke="#94a3b8" strokeDasharray="3 3" className="opacity-0 group-hover:opacity-100" />
            <text x={x(i)} y={H - B + 16} textAnchor="middle" fontSize="10.5" fill="#64748b">{lab}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#cbd5e1" />
      </svg>
      <Legend series={series} />
    </div>
  );
}

/** Thanh ngang cho tỉ lệ (VD: chuyên cần từng lớp). */
export function RateBar({ pct, color = "#10b981" }: { pct: number; color?: string }) {
  return <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>;
}
