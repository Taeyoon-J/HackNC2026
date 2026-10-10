import type { Market } from "../../api/types";
import { pct, price as fmtPrice, usd } from "../../lib/format";

/** Admin-only: the payout formula is not shown to students or traders. */
export function ScholarshipSummary({ market, finalGpa }: { market: Market; finalGpa?: number }) {
  if (market.probability != null && market.total_supply) return <ShareModelSummary market={market} finalGpa={finalGpa} />;
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

function ShareModelSummary({ market, finalGpa }: { market: Market; finalGpa?: number }) {
  const S = market.initial_scholarship_cents;
  const p = market.probability!;
  const goal = market.threshold;
  const current = market.final_price ?? market.last_price;
  const met = (gpa: number) => Math.round(S * ((gpa - goal) / p + 1));
  const missed = current !== null ? current * market.total_supply : null;
  const settled = market.status === "SETTLED" && market.scholarship;
  return <section className="card space-y-3 p-5"><h2 className="font-semibold text-ink">Scholarship</h2>
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      <div><dt className="text-xs text-muted">Scholarship (S)</dt><dd className="num text-xl font-semibold text-gold">{usd(S)}</dd></div>
      <div><dt className="text-xs text-muted">Probability (p)</dt><dd className="num text-xl font-semibold text-ink">{pct(p)}</dd></div>
      <div><dt className="text-xs text-muted">Goal GPA</dt><dd className="num text-xl font-semibold text-ink">{goal.toFixed(2)}</dd></div>
      <div><dt className="text-xs text-muted">{market.status === "SETTLED" ? "Final" : "Current"} share price</dt><dd className="num text-xl font-semibold text-brand">{fmtPrice(current)}</dd></div>
    </dl>
    {finalGpa !== undefined && !settled && <p className={`rounded-xl p-3 text-sm font-semibold ${finalGpa >= goal ? "bg-yes-soft text-yes" : "bg-gold-soft text-gold"}`}>
      Approving GPA {finalGpa.toFixed(2)} pays {usd(finalGpa >= goal ? met(finalGpa) : missed)}
      {finalGpa >= goal ? ` = S × ((${finalGpa.toFixed(2)} − ${goal.toFixed(2)}) / ${p.toFixed(2)} + 1)` : ` = final price ${fmtPrice(current)} × ${market.total_supply}`}
    </p>}
    <dl className="grid grid-cols-3 gap-3 text-xs">
      <div><dt className="text-muted">Goal met exactly</dt><dd className="num text-sm text-yes">{usd(met(goal))}</dd></div>
      <div><dt className="text-muted">Final GPA 4.00</dt><dd className="num text-sm text-yes">{usd(met(4))}</dd></div>
      <div><dt className="text-muted">Goal missed (current price)</dt><dd className="num text-sm text-body">{missed !== null ? usd(missed) : "Awaiting price"}</dd></div>
    </dl>
    <p className="text-xs text-muted">Goal met: S × ((final GPA − goal GPA) / p + 1). Goal missed: final share price × {market.total_supply} shares. Opening price was S / {market.total_supply} × p = {fmtPrice(Math.round(S / market.total_supply * p))}.</p>
    {settled && <p className="rounded-xl bg-gold-soft p-3 text-sm font-semibold text-gold">Paid: {usd(market.scholarship!.promised_cents)} · Final GPA {market.resolved_value}</p>}
  </section>;
}
