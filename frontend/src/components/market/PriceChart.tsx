import { price as fmtPrice } from "../../lib/format";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HistoryPoint } from "../../api/types";

const DAY = 86400;
const MIN_SPAN = 6 * 3600;
const MAX_SPAN = 730 * DAY;
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));

export function PriceChart({ points, max = 100 }: { points: HistoryPoint[]; /** share value in cents */ max?: number }) {
  const now = Math.floor(Date.now() / 1000);
  const [span, setSpan] = useState(7 * DAY);
  const [end, setEnd] = useState(now);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ x: number; end: number } | null>(null);
  const zoom = useRef<(direction: number) => void>(() => {});
  const oldest = Math.min(now, ...points.map((p) => p.t));
  const boundedEnd = clamp(end, Math.min(oldest + span, now), now);
  const start = boundedEnd - span;
  const step = span <= 2 * DAY ? "hour" : span <= 60 * DAY ? "day" : span <= 180 * DAY ? "week" : "month";
  zoom.current = (direction) => setSpan((s) => clamp(s * (direction > 0 ? 2 : 0.5), MIN_SPAN, MAX_SPAN));
  useEffect(() => {
    const element = box.current;
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoom.current(event.deltaY); };
    element?.addEventListener("wheel", wheel, { passive: false });
    return () => element?.removeEventListener("wheel", wheel);
  }, []);
  const rows = useMemo(() => {
    const buckets = new Map<number, { price: number; quantity: number }>();
    const sorted = [...points].filter((p) => p.t <= now).sort((a, b) => a.t - b.t);
    for (const p of sorted) {
      if (p.t < start || p.t > boundedEnd) continue;
      const d = new Date(p.t * 1000);
      const unit = step === "hour" ? 3600 : step === "week" ? 7 * DAY : DAY;
      const bucket = step === "month" ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000 : Math.floor(p.t / unit) * unit;
      const prev = buckets.get(bucket);
      buckets.set(bucket, { price: p.price, quantity: (prev?.quantity ?? 0) + p.quantity });
    }
    return [...buckets.entries()].map(([time, row]) => ({ time: Math.max(start, time), ...row }));
  }, [points, start, boundedEnd, step]);
  const x = (time: number) => 45 + (time - start) / span * 610;
  const y = (price: number) => 210 - (price / max) * 180;
  const maxVolume = Math.max(1, ...rows.map((r) => r.quantity));
  const format = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", step === "month" ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric", ...(step === "hour" ? { hour: "numeric" } : {}) });
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex gap-1">{[["1D", DAY], ["1W", 7 * DAY], ["1M", 30 * DAY], ["6M", 180 * DAY], ["1Y", 365 * DAY]].map(([label, seconds]) => <button key={String(label)} type="button"
        className={`btn px-2 ${span === seconds ? "bg-brand-soft text-brand" : "text-muted"}`} onClick={() => { setSpan(Number(seconds)); setEnd(now); }}>{label}</button>)}</div>
      <div className="flex items-center gap-2"><span className="text-muted">{step} steps</span><button type="button" aria-label="Zoom out" className="btn border border-line" onClick={() => zoom.current(1)}>−</button><button type="button" aria-label="Zoom in" className="btn border border-line" onClick={() => zoom.current(-1)}>+</button></div>
    </div>
    <div ref={box} className="touch-none select-none" style={{ cursor: "grab" }}
      onPointerDown={(e) => { dragging.current = { x: e.clientX, end: boundedEnd }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (dragging.current) setEnd(clamp(dragging.current.end - (e.clientX - dragging.current.x) / Math.max(1, e.currentTarget.clientWidth) * span, Math.min(oldest + span, now), now)); }}
      onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}>
      <svg viewBox="0 0 700 280" className="w-full" role="img" aria-label={`YES price chart with ${step} aggregation; future dates are blocked`}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={45} x2={655} y1={y(f * max)} y2={y(f * max)} stroke="#e8e1d6" /><text x={5} y={y(f * max) + 4} fill="#6b7280" fontSize={11}>{max > 100 ? `$${Math.round(f * max / 100)}` : fmtPrice(f * max)}</text></g>)}
        {rows.map((r) => <rect key={r.time} x={x(r.time) - 3} y={250 - r.quantity / maxVolume * 30} width={6} height={r.quantity / maxVolume * 30} fill="#b7791f" opacity={0.35} />)}
        <polyline points={rows.map((r) => `${x(r.time)},${y(r.price)}`).join(" ")} fill="none" stroke="#2f6f73" strokeWidth={2.5} />
        {rows.map((r) => <circle key={`p${r.time}`} cx={x(r.time)} cy={y(r.price)} r={3} fill="#2f6f73"><title>{format(r.time)} · YES {fmtPrice(r.price)} · {r.quantity} shares traded</title></circle>)}
        {Array.from({ length: 6 }, (_, i) => <text key={i} x={45 + i * 122} y={272} textAnchor="middle" fontSize={10} fill="#6b7280">{format(start + span * i / 5)}</text>)}
        {rows.length === 0 && <text x={350} y={120} textAnchor="middle" fontSize={14} fill="#6b7280">No trades in this time window</text>}
      </svg>
    </div>
    <p className="text-[10px] text-muted">Scroll or use +/− to change time steps. Drag to browse history. Dates after today are unavailable.</p>
  </div>;
}
