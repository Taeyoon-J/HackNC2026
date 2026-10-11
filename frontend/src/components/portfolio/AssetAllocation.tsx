import { useMemo, useState } from "react";
import { usd } from "../../lib/format";

const COLORS = { base: "#6596e8", additional: "#72b978", profit: "#d66b67", loss: "#e89a45", reduced: "#e5c84e", cash: "#94a3b8" };
export function AssetAllocation({ portfolio }: { portfolio: import("../../api/types").Portfolio }) {
  const [includeCash, setIncludeCash] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const bars = useMemo(() => portfolio.impact.map((row) => ({
    ...row,
    base: row.initial_expected_value_cents,
    additional: Math.max(0, row.additional_impact_cents - row.reduced_impact_cents),
    reduced: Math.max(0, row.reduced_impact_cents - row.additional_impact_cents),
    profit: Math.max(0, row.trading_profit_cents - row.trading_loss_cents),
    loss: Math.max(0, row.trading_loss_cents - row.trading_profit_cents),
  })), [portfolio.impact]);
  const positiveMax = Math.max(1, ...bars.map((b) => b.base + b.additional + b.profit), includeCash ? portfolio.available_cents + portfolio.reserved_cents : 0);
  const negativeMax = Math.max(1, ...bars.map((b) => b.reduced + b.loss));
  const totalBase = bars.reduce((sum, b) => sum + b.base, 0);
  const totalAdditional = portfolio.impact.reduce((sum, b) => sum + b.additional_impact_cents, 0);
  const totalProfit = portfolio.impact.reduce((sum, b) => sum + b.trading_profit_cents, 0);
  const totalLoss = portfolio.impact.reduce((sum, b) => sum + b.trading_loss_cents, 0);
  const totalReduced = portfolio.impact.reduce((sum, b) => sum + b.reduced_impact_cents, 0);
  const selected = hovered == null ? null : bars[hovered];
  const chartWidth = Math.max(620, bars.length * 105 + (includeCash ? 105 : 0));
  const top = 20, baseline = 210, bottom = 275, plotHeight = baseline - top;
  const posY = (value: number) => baseline - value / positiveMax * plotHeight;
  const summary = [
    ["Initial expected value", totalBase, COLORS.base, "Money you contributed for shares still held through close."],
    ["Additional impact created", totalAdditional, COLORS.additional, "Final value above your purchase cost, for shares held through close."],
    ["Trading profit", totalProfit, COLORS.profit, "Gross gains from shares sold above their purchase cost."],
    ["Trading loss", totalLoss, COLORS.loss, "Gross losses from shares sold below their purchase cost; these offset trading profit."],
    ["Reduced impact", totalReduced, COLORS.reduced, "Value lost at close when held shares finish below your purchase cost."],
  ] as const;

  return <section className="card space-y-4 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-ink">Cumulative Sponsorship Impact</h2><p className="text-xs text-muted">Your contribution and the additional scholarship impact it creates.</p></div>
      <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={includeCash} onChange={(e) => { setIncludeCash(e.target.checked); setHovered(null); }} />Include available cash</label>
    </div>
    {bars.length || includeCash ? <>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} 310`} className="min-w-full" style={{ width: chartWidth }} role="img" aria-label="Stacked sponsorship impact by student market">
          {[0, .25, .5, .75, 1].map((f) => { const val = positiveMax * f; const y = posY(val); return <g key={f}><line x1="48" x2={chartWidth - 12} y1={y} y2={y} stroke="#e8e1d6" strokeDasharray={f ? "3 4" : undefined} /><text x="42" y={y + 4} textAnchor="end" fill="#6b7280" fontSize="10">{usd(val, 0)}</text></g>; })}
          <line x1="48" x2={chartWidth - 12} y1={baseline} y2={baseline} stroke="#9ca3af" />
          {bars.map((b, i) => {
            const x = 66 + i * ((chartWidth - 80) / Math.max(1, bars.length + (includeCash ? 1 : 0)));
            const width = Math.min(58, (chartWidth - 80) / Math.max(1, bars.length + Number(includeCash)) - 16);
            let cursor = baseline;
            const segments = [[b.base, COLORS.base], [b.additional, COLORS.additional], [b.profit, COLORS.profit]] as const;
            const shapes = segments.map(([value, color], j) => { const height = value / positiveMax * plotHeight; cursor -= height; return <rect key={j} x={x} y={cursor} width={width} height={height} fill={color} rx={j === 0 ? 5 : 1} />; });
            let negCursor = baseline;
            const negatives = [[b.loss, COLORS.loss], [b.reduced, COLORS.reduced]] as const;
            const negativeShapes = negatives.map(([value, color], j) => { const height = value / negativeMax * (bottom - baseline); const y = negCursor; negCursor += height; return <rect key={j} x={x} y={y} width={width} height={height} fill={color} rx={j === 0 ? 5 : 1} />; });
            return <g key={b.market_id} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(i)} tabIndex={0} role="img" aria-label={`${b.student_name}: initial ${usd(b.base)}, additional impact ${usd(b.additional_impact_cents)}, trading profit ${usd(b.trading_profit_cents)}, trading loss ${usd(b.trading_loss_cents)}, reduced impact ${usd(b.reduced_impact_cents)}`}>
              <rect x={x - 5} y={top} width={width + 10} height={bottom - top} fill="transparent" />{shapes}{negativeShapes}
              {selected?.market_id === b.market_id && <text x={x + width / 2} y={Math.max(13, posY(b.base + b.additional + b.profit) - 5)} textAnchor="middle" fontSize="10" fill="#263238">{usd(b.base + b.additional + b.profit)}</text>}
              <text x={x + width / 2} y="294" textAnchor="middle" fontSize="10" fill="#6b7280">{b.student_name.length > 10 ? `${b.student_name.slice(0, 9)}…` : b.student_name}</text>
            </g>;
          })}
          {includeCash && <g><rect x={chartWidth - 82} y={posY(portfolio.available_cents + portfolio.reserved_cents)} width="58" height={baseline - posY(portfolio.available_cents + portfolio.reserved_cents)} fill={COLORS.cash} rx="5" /><text x={chartWidth - 53} y="294" textAnchor="middle" fontSize="10" fill="#6b7280">Cash</text></g>}
        </svg>
      </div>
      {selected && <div className="rounded-xl bg-sunken p-3 text-sm"><div className="mb-2 font-semibold text-ink">{selected.student_name} · {selected.term}{selected.settled ? " · Final" : " · Current estimate"}</div><div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">{summary.map(([label], i) => { const values = [selected.base, selected.additional_impact_cents, selected.trading_profit_cents, selected.trading_loss_cents, selected.reduced_impact_cents]; return <div key={label} className="flex justify-between gap-2"><span>{label}</span><strong className="num">{usd(values[i])}</strong></div>; })}</div></div>}
      <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">{summary.map(([label, value, color, explanation]) => <div key={label} className="flex gap-2"><span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: color }} /><div><div className="text-xs text-muted">{label}</div><div className="num font-semibold text-ink">{usd(value)}</div><p className="mt-1 text-[11px] leading-snug text-muted">{explanation}</p></div></div>)}</div>
      <p className="text-xs text-muted">Trading losses offset trading profits. At final GPA settlement, held shares are retired and add no cash to your available balance.</p>
    </> : <p className="py-8 text-center text-sm text-muted">No contribution history yet. Buy YES shares in a student market to create sponsorship impact.</p>}
  </section>;
}
