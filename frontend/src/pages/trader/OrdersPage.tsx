import { useState } from "react";
import { OpenOrdersTable } from "../../components/trading/OpenOrdersTable";
import { usePortfolio } from "../../hooks/queries";
import { usd } from "../../lib/format";

export function OrdersPage() {
  const { data: p, error } = usePortfolio();
  const [search, setSearch] = useState("");
  const [side, setSide] = useState("");
  if (error) return <p className="text-no">{error.message}</p>;
  if (!p) return <div className="card h-64 animate-pulse" />;
  const orders = p.open_orders.filter((o) => (!side || o.action === side) && `${o.market_id} ${o.student?.name ?? ""} ${o.action}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-4">
    <div><h1 className="font-display text-2xl font-semibold text-ink">My pending orders</h1><p className="text-sm text-muted">All unfilled limit orders across your student markets. Cancelling releases reserved cash or shares.</p></div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="card p-4"><span className="text-xs text-muted">Open orders</span><div className="num text-2xl">{p.open_orders.length}</div></div>
      <div className="card p-4"><span className="text-xs text-muted">Reserved cash</span><div className="num text-2xl">{usd(p.reserved_cents)}</div></div>
      <div className="card p-4"><span className="text-xs text-muted">Shares offered for sale</span><div className="num text-2xl">{p.open_orders.filter((o) => o.action === "SELL").reduce((s, o) => s + o.remaining, 0)}</div></div></div>
    <div className="card flex gap-3 p-4"><input type="search" className="input" aria-label="Search pending orders" placeholder="Search by student name or market ID" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select className="input max-w-40" aria-label="Order side" value={side} onChange={(e) => setSide(e.target.value)}><option value="">All orders</option><option value="BUY">Buy</option><option value="SELL">Sell</option></select></div>
    <OpenOrdersTable orders={orders} showMarket />
  </div>;
}
