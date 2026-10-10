import type { Market } from "../../api/types";
import { usd } from "../../lib/format";

export function ScholarshipSummary({ market }: { market: Market }) {
  if (!market.total_supply && market.status === "SETTLED") return <section className="card space-y-3 p-5">
    <h2 className="font-semibold text-ink">Completed scholarship</h2>
    <p className="num text-xl font-semibold text-gold">{usd(market.scholarship?.promised_cents)}</p>
    <p className="text-xs text-muted">Final GPA {market.resolved_value} · {market.scholarship?.status === "PAID" ? "Paid" : "Completed"}</p>
  </section>;
  const initial = market.initial_scholarship_cents;
  const price = market.final_price ?? market.last_price ?? (market.best_bid !== null && market.best_ask !== null ? Math.round((market.best_bid + market.best_ask) / 2) : market.best_ask ?? market.best_bid);
  const adjustment = price !== null ? price * 100 : null;
  return <section className="card space-y-3 p-5"><h2 className="font-semibold text-ink">Scholarship</h2>
    <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted">Initial amount</dt><dd className="num text-xl font-semibold text-gold">{usd(initial)}</dd></div>
      <div><dt className="text-xs text-muted">{market.status === "SETTLED" ? "Final" : "Current"} YES price</dt><dd className="num text-xl font-semibold text-brand">{price !== null ? `$${(price / 100).toFixed(2)}` : "No quote yet"}</dd></div>
      <div><dt className="text-xs text-muted">If goal achieved</dt><dd className="num text-yes">{adjustment !== null ? usd(initial + adjustment) : "Awaiting price"}</dd></div>
      <div><dt className="text-xs text-muted">If goal missed</dt><dd className="num text-body">{adjustment !== null ? usd(initial - adjustment) : "Awaiting price"}</dd></div>
    </dl>
    <p className="text-xs text-muted">Initial scholarship ± final YES price (0–1) × $100. Both outcomes pay the resulting scholarship when final GPA is verified.</p>
    {market.status === "SETTLED" && market.scholarship && <p className="rounded-xl bg-gold-soft p-3 text-sm font-semibold text-gold">Paid: {usd(market.scholarship.promised_cents)} · Final GPA {market.resolved_value}</p>}
  </section>;
}
