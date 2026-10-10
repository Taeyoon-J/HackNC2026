import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { Market, MarketStatus } from "../../api/types";
import { useAction } from "../../hooks/queries";
import { dateShort, usd } from "../../lib/format";
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

const TERMS = ["Fall 2026", "Spring 2027", "Fall 2027"];

export function GoalCard({ markets, canPropose }: { markets: Market[]; canPropose: boolean }) {
  const active = markets.find((m) => m.status !== "SETTLED");
  const past = markets.filter((m) => m.status === "SETTLED");
  return (
    <div className="space-y-4">
      {active ? <ActiveGoal market={active} /> : <ProposeGoal disabled={!canPropose} />}
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
          <span className="card-title">My goal · {market.term}</span>
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
          <div className="text-[11px] text-muted">Final amount = initial ± final YES price × $100</div>
        </div>
        <div>
          <div className="text-xs text-muted">Community forecast</div>
          <div className="num font-display text-2xl font-semibold text-brand">
            {market.last_price != null ? `${market.last_price}%` : "—"}
          </div>
          <div className="text-[11px] text-muted">Deadline {dateShort(market.deadline)}</div>
        </div>
      </div>
      {market.status !== "DRAFT" && (
        <Link to={`/markets/${market.id}`} className="block border-t border-line px-5 py-3 text-sm font-semibold text-brand hover:bg-brand-soft">
          See how the community sees my goal →
        </Link>
      )}
    </div>
  );
}

function ProposeGoal({ disabled }: { disabled: boolean }) {
  const [threshold, setThreshold] = useState("3.5");
  const [term, setTerm] = useState(TERMS[0]);
  const propose = useAction(api.me.proposeGoal);
  const t = Number(threshold);
  return (
    <div className="card p-5">
      <div className="card-title">Set a goal</div>
      <p className="mt-1 text-sm text-body">
        Pick a GPA target for an upcoming term. Your initial scholarship is adjusted by the final YES price
        after your semester grades are verified.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          GPA target
          <input className="input num mt-1" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </label>
        <label className="block text-xs text-muted">
          Term
          <select className="input mt-1" value={term} onChange={(e) => setTerm(e.target.value)}>
            {TERMS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        className="btn mt-4 w-full bg-brand py-2.5 text-white hover:bg-brand-strong"
        disabled={disabled || !(t >= 2 && t <= 4) || propose.isPending}
        onClick={() => propose.mutate({ threshold: t, term })}
      >
        Submit goal for review
      </button>
      {disabled && <p className="mt-2 text-xs text-muted">Your profile is currently not listed.</p>}
      {propose.error && <p className="mt-2 text-xs text-no">{propose.error.message}</p>}
    </div>
  );
}
