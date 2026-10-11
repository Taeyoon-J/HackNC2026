import { Link } from "react-router-dom";
import type { Market } from "../../api/types";
import { dateShort, usd, chance } from "../../lib/format";
import { bucketHistory, fivePercentPriceDomain } from "../../lib/history";
import { FavoriteButton } from "./FavoriteButton";
import { MarketStatusBadge } from "./MarketStatusBadge";

export function MarketCard({ market }: { market: Market }) {
  const forecast = chance(market);
  const settled = market.status === "SETTLED";
  const letter = market.student.name.replace("Student ", "");
  const now = Math.floor(Date.now() / 1000);
  const week = 7 * 86400;
  const sparkline = bucketHistory(market.sparkline ?? [], now - week, now, "day", now);
  const [low, high] = fivePercentPriceDomain(market.last_price ?? sparkline[sparkline.length - 1]?.price ?? 50);
  const firstTime = sparkline[0]?.time ?? now;
  const lastTime = sparkline[sparkline.length - 1]?.time ?? now;
  const x = (time: number) => sparkline.length < 2 ? 60 : 5 + (time - firstTime) / (lastTime - firstTime) * 110;
  const y = (value: number) => 43 - Math.max(0, Math.min(1, (value - low) / (high - low))) * 36;
  const path = sparkline.map((point) => `${x(point.time)},${y(point.price)}`).join(" ");

  return (
    <Link to={`/markets/${market.id}`} className="card group flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft px-1 text-center font-display text-xs font-semibold leading-tight text-brand" style={{ flex: "0 0 2.5rem", maxWidth: "2.5rem", whiteSpace: "nowrap" }} aria-hidden="true">
            {letter.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div title={market.student.name} className="truncate font-semibold text-ink">{market.student.name}</div>
            <div className="truncate text-xs text-muted">{market.student.year} · {market.student.major}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2"><MarketStatusBadge status={market.status} /><FavoriteButton marketId={market.id} /></div>
      </div>

      <div className="text-xs text-muted">{market.student.university}</div>
      <div className="text-xs text-muted">Cumulative GPA <span className="num font-semibold text-ink">{market.student.cumulative_gpa != null ? market.student.cumulative_gpa.toFixed(2) : "None"}</span></div>
      {market.student.introduction && <p className="line-clamp-2 text-sm text-body">{market.student.introduction}</p>}

      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-3 rounded-xl bg-sunken px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Goal · {market.term}</div>
          <div className="mt-0.5 font-display text-lg font-semibold leading-tight text-ink">{market.metric} ≥{market.threshold.toFixed(1)}</div>
        </div>
        <div className="min-w-0 border-l border-line pl-3" aria-label="One-week share price history">
          <div className="mb-1 text-[10px] text-muted">1W share price</div>
          <svg viewBox="0 0 120 48" className="h-14 w-full" role="img" aria-label="Recent share price chart">
            <g fill="none" stroke="#d9e1df" strokeWidth="0.7"><path d="M0 12H120 M0 24H120 M0 36H120 M30 0V48 M60 0V48 M90 0V48" /></g>
            {sparkline.length > 1 && <polyline points={path} fill="none" stroke="#2f6f73" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {sparkline.length === 1 && <circle cx={x(sparkline[0].time)} cy={y(sparkline[0].price)} r="2.5" fill="#2f6f73" />}
          </svg>
        </div>
      </div>

      {settled ? (
        <div className="flex items-center gap-2 text-sm">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${market.outcome === "YES" ? "bg-yes-soft text-yes" : "bg-no-soft text-no"}`}>{market.outcome === "YES" ? "Goal achieved" : "Goal not met"}</span>
          <span className="text-muted">Verified {market.metric} {market.resolved_value}</span>
        </div>
      ) : (
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted">Community forecast</span>
          <span className="num font-semibold text-ink">{forecast != null ? `${forecast}% likely` : "—"}</span>
        </div>
      )}

      <div className="mt-auto flex items-end justify-between border-t border-line pt-3">
        <div>
          <div className="text-xs text-muted">{settled ? "Scholarship paid" : "Initial scholarship"}</div>
          <div className={`num font-display text-xl font-semibold ${market.scholarship ? "text-gold" : "text-faint"}`}>{settled && market.scholarship ? usd(market.scholarship.promised_cents, 0) : usd(market.initial_scholarship_cents, 0)}</div>
        </div>
        <div className="text-right text-xs text-muted"><div>{settled ? "Closed" : "Closes"}</div><div className="font-semibold text-body">{dateShort(market.deadline)}</div></div>
      </div>
    </Link>
  );
}
