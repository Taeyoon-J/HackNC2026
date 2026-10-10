import { Link } from "react-router-dom";
import type { Market } from "../../api/types";
import { dateShort, usd, chance } from "../../lib/format";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { FavoriteButton } from "./FavoriteButton";

export function MarketCard({ market }: { market: Market }) {
  const p = chance(market);
  const settled = market.status === "SETTLED";
  const letter = market.student.name.replace("Student ", "");
  const sparkline = market.sparkline ?? [];
  const prices = sparkline.map((point) => point.price);
  const values = prices.length ? prices : market.last_price == null ? [] : [market.last_price, market.last_price];
  const low = Math.min(...values, 0);
  const high = Math.max(...values, 100);
  const path = values.map((value, index) => (index / Math.max(1, values.length - 1) * 120) + "," +
    (34 - (value - low) / Math.max(1, high - low) * 28)).join(" ");
  return (
    <Link
      to={`/markets/${market.id}`}
      className="card group flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft px-1 text-center font-display text-xs font-semibold leading-tight text-brand" style={{ flex: "0 0 2.5rem", maxWidth: "2.5rem", whiteSpace: "nowrap" }} aria-hidden="true">
            {letter.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div title={market.student.name} className="truncate font-semibold text-ink">{market.student.name}</div>
            <div className="truncate text-xs text-muted">
              {market.student.year} · {market.student.major}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2"><MarketStatusBadge status={market.status} /><FavoriteButton marketId={market.id} /></div>
      </div>

      <div className="text-xs text-muted">{market.student.university}</div>
      <div className="text-xs text-muted">Cumulative GPA <span className="num font-semibold text-ink">{market.student.cumulative_gpa != null ? market.student.cumulative_gpa.toFixed(2) : "None"}</span></div>
      {market.student.introduction && <p className="line-clamp-2 text-sm text-body">{market.student.introduction}</p>}

      <div className="rounded-xl bg-sunken px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Goal · {market.term}</div>
        <div className="mt-0.5 font-display text-lg font-semibold text-ink">
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
        </div>
      )}

      {values.length > 1 && <div className="rounded-xl bg-sunken px-3 py-2" aria-label="Recent share price history">
        <div className="mb-1 flex justify-between text-[10px] text-muted"><span>{sparkline.length ? "Recent share price" : "Current share price"}</span><span>{sparkline.length ? `${sparkline.length} trades` : `${p ?? 0}%`}</span></div>
        <svg viewBox="0 0 120 38" className="h-10 w-full" role="img" aria-label="Recent share price chart">
          <g fill="none" stroke="#d9e1df" strokeWidth="0.7"><path d="M0 9H120 M0 19H120 M0 29H120 M30 0V38 M60 0V38 M90 0V38" /></g>
          <polyline points={path} fill="none" stroke="#2f6f73" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>}

      <div className="mt-auto flex items-end justify-between border-t border-line pt-3">
        <div>
          <div className="text-xs text-muted">
            {settled ? "Scholarship paid" : "Initial scholarship"}
          </div>
          <div className={`num font-display text-xl font-semibold ${market.scholarship ? "text-gold" : "text-faint"}`}>
            {settled && market.scholarship ? usd(market.scholarship.promised_cents, 0) : usd(market.initial_scholarship_cents, 0)}
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
