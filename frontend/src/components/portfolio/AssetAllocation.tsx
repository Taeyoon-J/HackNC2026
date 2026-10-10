import { useState } from "react";
import type { Portfolio } from "../../api/types";
import { usd } from "../../lib/format";

const COLORS = ["#2f6f73", "#b7791f", "#7c6fa1", "#679468", "#c47c63", "#6596b6", "#7b8392"];

export function AssetAllocation({ portfolio }: { portfolio: Portfolio }) {
  const [cash, setCash] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const assets = portfolio.positions.filter((p) => p.market_value_cents > 0).map((p) => ({
    name: p.student.name, value: p.market_value_cents, detail: `${p.quantity} YES shares · ${p.student.major}`,
  }));
  if (cash) assets.push({ name: "Cash", value: portfolio.available_cents + portfolio.reserved_cents, detail: "Available cash + reserved order funds" });
  const total = assets.reduce((s, a) => s + a.value, 0);
  let accumulated = 0;
  const gradient = assets.map((a, i) => { const start = accumulated; accumulated += total ? a.value / total * 100 : 0;
    return `${COLORS[i % COLORS.length]} ${start}% ${accumulated}%`; }).join(", ");
  const focused = hovered !== null ? assets[hovered] : null;
  return <section className="card p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-ink">{cash ? "Total asset distribution" : "Holdings distribution"}</h2>
      <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={cash} onChange={(e) => { setCash(e.target.checked); setHovered(null); }} />Include cash</label></div>
    {total ? <div className="grid items-center gap-6 sm:grid-cols-[240px_1fr]">
      <div className="relative mx-auto grid h-52 w-52 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={assets.map((a) => `${a.name} ${(a.value / total * 100).toFixed(1)} percent`).join(", ")}>
        <div className="grid h-32 w-32 content-center rounded-full bg-surface px-3 text-center"><span className="text-xs text-muted">{focused?.name ?? (cash ? "Total assets" : "Holdings")}</span><strong className="num text-xl text-ink">{usd(focused?.value ?? total)}</strong></div>
      </div>
      <div className="space-y-2">{assets.map((a, i) => <button key={a.name} type="button" onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-sunken"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{a.name}</span><span className="block text-xs text-muted">{a.detail}</span></span>
        <span className="text-right text-sm text-body">{usd(a.value)}<span className="block text-xs text-muted">{(a.value / total * 100).toFixed(1)}%</span></span>
      </button>)}</div>
    </div> : <p className="py-8 text-center text-sm text-muted">No holdings yet. Buy YES shares from a student market to build your portfolio.</p>}
  </section>;
}
