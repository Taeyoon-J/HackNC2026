import type { SettlementRow } from "../../api/types";
import { timeShort, usd } from "../../lib/format";

export function SettlementHistory({ rows }: { rows: SettlementRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="card">
      <div className="card-title border-b border-line px-4 py-3">Settlements</div>
      <table className="w-full text-xs">
        <tbody>
          {rows.map((s) => (
            <tr key={`${s.market_id}-${s.contract}`} className="border-t border-line first:border-0">
              <td className="px-4 py-2 font-mono text-muted">{s.market_id}</td>
              <td className={`px-2 py-2 ${s.contract === "YES" ? "text-yes" : "text-no"}`}>
                {s.contract} × {s.quantity}
              </td>
              <td className="num px-2 py-2 text-right font-medium">{usd(s.payout_cents)}</td>
              <td className="num px-4 py-2 text-right text-muted">{timeShort(s.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
