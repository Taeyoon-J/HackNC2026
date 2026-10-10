import { Link } from "react-router-dom";
import type { PositionRow } from "../../api/types";
import { cents, usd } from "../../lib/format";
import { MarketStatusBadge } from "../market/MarketStatusBadge";

export function PositionsTable({ positions }: { positions: PositionRow[] }) {
  return (
    <div className="card">
      <div className="card-title border-b border-line px-4 py-3">Positions</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-normal">Market</th>
              <th className="px-2 py-2 text-left font-normal">Contract</th>
              <th className="px-2 py-2 text-right font-normal">Qty</th>
              <th className="px-2 py-2 text-right font-normal">Avg cost</th>
              <th className="px-2 py-2 text-right font-normal">Mark</th>
              <th className="px-2 py-2 text-right font-normal">Value</th>
              <th className="px-4 py-2 text-right font-normal">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={`${p.market_id}-${p.contract}`} className="border-t border-line">
                <td className="px-4 py-2">
                  <Link to={`/markets/${p.market_id}`} className="hover:text-ink">
                    <div className="max-w-xs truncate text-ink">{p.question}</div>
                  </Link>
                  <MarketStatusBadge status={p.market_status} />
                </td>
                <td className={`px-2 py-2 font-semibold ${p.contract === "YES" ? "text-yes" : "text-no"}`}>{p.contract}</td>
                <td className="num px-2 py-2 text-right">
                  {p.quantity}
                  {p.reserved_qty > 0 && <span className="text-muted"> ({p.reserved_qty} listed)</span>}
                </td>
                <td className="num px-2 py-2 text-right">{cents(p.avg_cost_cents)}</td>
                <td className="num px-2 py-2 text-right">{cents(p.mark_cents)}</td>
                <td className="num px-2 py-2 text-right">{usd(p.market_value_cents)}</td>
                <td className={`num px-4 py-2 text-right ${p.unrealized_pnl_cents >= 0 ? "text-yes" : "text-no"}`}>
                  {p.unrealized_pnl_cents >= 0 ? "+" : ""}
                  {usd(p.unrealized_pnl_cents)}
                </td>
              </tr>
            ))}
            {positions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  No positions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
