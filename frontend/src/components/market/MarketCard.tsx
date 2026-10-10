import { Link } from "react-router-dom";
import type { Market } from "../../api/types";
import { dateShort, usd } from "../../lib/format";
import { MarketStatusBadge } from "./MarketStatusBadge";

export function MarketCard({ market }: { market: Market }) {
  const p = market.last_price;
  const settled = market.status === "SETTLED";
  const letter = market.student.name.replace("Student ", "");
  return (
    <Link
      to={`/markets/${market.id}`}
      className="card group flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft font-display text-lg font-semibold text-brand">
            {letter}
          </span>
          <div>
            <div className="font-semibold text-ink">{market.student.name}</div>
            <div className="text-xs text-muted">
              {market.student.year} · {market.student.major}
            </div>
          </div>
        </div>
        <MarketStatusBadge status={market.status} />
      </div>

      <div className="rounded-xl bg-sunken px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Goal · {market.term}</div>
        <div className="mt-0.5 font-display text-xl font-semibold text-ink">
          {market.metric} ≥ {market.threshold.toFixed(1)}
        </div>
      </div>

      {settled ? (
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${market.outcome === "YES" ? "bg-yes-soft text-yes" : "bg-no-soft text-no"}`}
          >
            {market.outcome === "YES" ? "Goal achieved" : "Goal not met"}
          </span>
          <span className="text-muted">
            Verified {market.metric} {market.resolved_value}
          </span>
        </div>
      ) : (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted">Community forecast</span>
            <span className="num font-semibold text-ink">{p != null ? `${p}% likely` : "—"}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full bg-brand" style={{ width: `${p ?? 0}%` }} />
          </div>
        </div>
      )}

      <div className="mt-auto flex items-end justify-between border-t border-line pt-3">
        <div>
          <div className="text-xs text-muted">
            {settled ? "Scholarship" : market.scholarship ? "Scholarship if achieved" : "Scholarship"}
          </div>
          <div className={`num font-display text-xl font-semibold ${market.scholarship ? "text-gold" : "text-faint"}`}>
            {market.scholarship ? usd(market.scholarship.promised_cents, 0) : "Being priced"}
          </div>
        </div>
        <div className="text-right text-xs text-muted">
          <div>{settled ? "Closed" : "Closes"}</div>
          <div className="font-semibold text-body">{dateShort(market.deadline)}</div>
        </div>
      </div>
    </Link>
  );
}
