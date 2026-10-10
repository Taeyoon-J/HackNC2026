import type { Market } from "../../api/types";
import { dateShort, qty, usd } from "../../lib/format";
import { MarketStatusBadge } from "./MarketStatusBadge";

export function MarketHeader({ market }: { market: Market }) {
  const s = market.scholarship;
  return (
    <div className="card space-y-4 p-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted">
          <span className="font-mono">{market.id}</span>
          <MarketStatusBadge status={market.status} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink">{market.question}</h1>
        <p className="mt-1 text-sm text-muted">
          Each correct contract pays $1 · Closes {dateShort(market.deadline)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Cumulative GPA" value={market.student.cumulative_gpa != null ? market.student.cumulative_gpa.toFixed(2) : "None"} />
        <Kpi label="Goal GPA" value={market.threshold.toFixed(1)} />
        <Kpi label="Community forecast" value={market.last_price != null ? `${market.last_price}%` : "—"} accent="text-brand" />
        <Kpi label="24h average" value={market.vwap_24h != null ? `${market.vwap_24h.toFixed(1)}¢` : "—"} />
        <Kpi label="Volume" value={qty(market.volume)} />
        <Kpi
          label={market.status === "SETTLED" ? "Scholarship paid" : "Initial scholarship"}
          value={market.status === "SETTLED" && s ? usd(s.promised_cents) : usd(market.initial_scholarship_cents)}
          accent={s ? "text-gold" : "text-muted"}
        />
      </div>
    </div>
  );
}

function Kpi({ label, value, accent = "text-ink" }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`num text-lg font-semibold ${accent}`}>{value}</div>
    </div>
  );
}
