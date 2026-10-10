import type { Market, MarketStatus } from "../../api/types";
import { dateShort, usd, chance } from "../../lib/format";
import { MarketStatusBadge } from "../market/MarketStatusBadge";

const STATUS_NOTE: Record<MarketStatus, string> = {
  DRAFT: "",
  PRICE_DISCOVERY: "The community is forecasting your goal. Final GPA approval determines your scholarship.",
  SCHOLARSHIP_LOCKED: "Your scholarship is locked in. Reach your goal to earn it.",
  TRADING: "Final GPA verification ends trading and determines your scholarship.",
  CLOSED: "The term is over. Waiting for your verified results.",
  RESOLVED: "Results verified. Payout is being processed.",
  SETTLED: "This goal is complete.",
};

export function GoalCard({ markets }: { markets: Market[] }) {
  const active = markets.find((m) => m.status !== "SETTLED");
  const past = markets.filter((m) => m.status === "SETTLED");
  return (
    <div className="space-y-4">
      {active ? <ActiveGoal market={active} /> : <div className="card p-5 text-sm text-muted">Your next GPA goal will be assigned by an admin after verification.</div>}
      {past.length > 0 && (
        <div className="card p-5">
          <div className="card-title mb-3">Past goals</div>
          <ul className="space-y-2 text-sm">
            {past.map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <span>
                  {m.term} · GPA ≥ {m.threshold}
                </span>
                <span className={m.outcome === "YES" ? "font-semibold text-yes" : "text-muted"}>
                  {m.scholarship?.status === "PAID" ? `Received ${usd(m.scholarship.promised_cents)}` : "Complete"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ActiveGoal({ market }: { market: Market }) {
  const s = market.scholarship;
  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-br from-brand-soft to-gold-soft p-5">
        <div className="flex items-center justify-between">
          <span className="card-title">Admin-assigned goal · {market.term}</span>
          {market.status !== "DRAFT" && <MarketStatusBadge status={market.status} />}
        </div>
        <div className="mt-2 font-display text-3xl font-semibold text-ink">GPA ≥ {market.threshold.toFixed(1)}</div>
        {STATUS_NOTE[market.status] && <p className="mt-2 text-sm text-body">{STATUS_NOTE[market.status]}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4 p-5">
        <div>
          <div className="text-xs text-muted">Initial scholarship</div>
          <div className={`num font-display text-2xl font-semibold ${s ? "text-gold" : "text-faint"}`}>
            {market.initial_scholarship_cents ? usd(market.initial_scholarship_cents) : s ? usd(s.promised_cents) : "Being assigned"}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Community forecast</div>
          <div className="num font-display text-2xl font-semibold text-brand">
            {chance(market) != null ? `${chance(market)}%` : "—"}
          </div>
          <div className="text-[11px] text-muted">Deadline {dateShort(market.deadline)}</div>
        </div>
      </div>
    </div>
  );
}
