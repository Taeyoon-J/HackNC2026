import type { Portfolio } from "../../api/types";
import { usd } from "../../lib/format";

export function BalanceSummary({ p }: { p: Portfolio }) {
  const pnl = p.positions.reduce((s, r) => s + r.unrealized_pnl_cents, 0);
  const items = [
    { label: "Available", value: usd(p.available_cents) },
    { label: "Reserved (open buys)", value: usd(p.reserved_cents) },
    { label: "Position value", value: usd(p.positions_value_cents) },
    {
      label: "Unrealized P&L",
      value: `${pnl >= 0 ? "+" : ""}${usd(pnl)}`,
      cls: pnl > 0 ? "text-yes" : pnl < 0 ? "text-no" : "text-ink",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="card p-4">
          <div className="text-xs text-muted">{i.label}</div>
          <div className={`num mt-1 text-xl font-semibold ${i.cls ?? "text-ink"}`}>{i.value}</div>
        </div>
      ))}
    </div>
  );
}
