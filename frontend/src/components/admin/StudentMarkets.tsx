import { Link } from "react-router-dom";
import type { AdminStudentDetail } from "../../api/types";
import { usd, dateShort } from "../../lib/format";
import { MarketStatusBadge } from "../market/MarketStatusBadge";

export function StudentMarkets({ student }: { student: AdminStudentDetail }) {
  return <section className="mt-5 space-y-4 border-t border-line pt-5">
    <h3 className="card-title">GPA goals, probability & buyers</h3>
    {student.market_details.length === 0 && <p className="text-sm text-muted">No GPA goal assigned yet. Registration approval assigns the goal and initial probability.</p>}
    {student.market_details.map((market) => {
      const holders = student.holders.filter((h) => h.market_id === market.id);
      return <div key={market.id} className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><Link className="font-semibold text-brand hover:underline" to={`/admin?market=${encodeURIComponent(market.id)}`}>{market.term}</Link><MarketStatusBadge status={market.status} /></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Metric label="Goal GPA" value={market.threshold.toFixed(2)} />
          <Metric label="Achievement probability" value={market.last_price != null ? `${market.last_price}%` : "Not priced yet"} />
          <Metric label="Initial scholarship" value={market.initial_scholarship_cents ? usd(market.initial_scholarship_cents) : "Not assigned yet"} />
          <Metric label="Shares issued" value={String(market.total_supply)} />
          <Metric label="Trading volume" value={String(market.volume)} />
          <Metric label="Deadline" value={dateShort(market.deadline)} />
          {market.resolved_value != null && <Metric label="Final verified GPA" value={market.resolved_value.toFixed(2)} />}
          {market.outcome && <Metric label="Goal outcome" value={market.outcome === "YES" ? "Achieved" : "Missed"} />}
          {market.scholarship?.status === "PAID" && <Metric label="Scholarship paid" value={usd(market.scholarship.promised_cents)} />}
        </div>
        <h4 className="mb-2 mt-4 text-sm font-semibold text-ink">Buyers / current holders · {holders.length}</h4>
        {holders.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-muted"><tr><th className="py-2">Buyer</th><th>Contract</th><th>Shares</th><th>Reserved to sell</th><th>Purchase cost</th><th>Current value</th></tr></thead>
          <tbody>{holders.map((holder) => <tr key={`${holder.user_id}-${holder.contract}`} className="border-t border-line"><td className="py-2"><strong>{holder.name}</strong><div className="text-muted">{holder.user_id}</div></td><td>{holder.contract}</td><td>{holder.quantity}</td><td>{holder.reserved_qty}</td><td>{usd(holder.cost_basis_cents)}</td><td>{market.last_price != null ? usd(holder.quantity * (holder.contract === "YES" ? market.last_price : 100 - market.last_price)) : "Not priced yet"}</td></tr>)}</tbody>
        </table></div> : <p className="text-sm text-muted">No trader currently holds shares in this goal.</p>}
      </div>;
    })}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted">{label}</div><div className="num mt-1 font-semibold text-ink">{value}</div></div>;
}
