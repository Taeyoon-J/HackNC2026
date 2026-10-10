import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { Order } from "../../api/types";
import { useAction } from "../../hooks/queries";
import { timeShort, price } from "../../lib/format";

export function OpenOrdersTable({ orders, showMarket = false }: { orders: Order[]; showMarket?: boolean }) {
  const cancel = useAction(api.cancelOrder);
  return (
    <div className="card">
      <div className="card-title border-b border-line px-4 py-3">Open orders</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted">
            <tr>
              {showMarket && <th className="px-4 py-2 text-left font-normal">Market</th>}
              <th className="px-4 py-2 text-left font-normal">Order</th>
              <th className="px-2 py-2 text-right font-normal">Price</th>
              <th className="px-2 py-2 text-right font-normal">Filled/Qty</th>
              <th className="px-2 py-2 text-left font-normal">Time</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-line">
                {showMarket && (
                  <td className="px-4 py-2 font-mono text-muted">
                    <Link to={`/markets/${o.market_id}`} className="hover:text-ink">
                      <span className="block font-sans font-semibold text-ink">{o.student?.name ?? o.market_id}</span>
                      {o.student && <span className="text-[10px]">{o.market_id}</span>}
                    </Link>
                  </td>
                )}
                <td className="px-4 py-2">
                  <span className={o.contract === "YES" ? "text-yes" : "text-no"}>{o.contract}</span>{" "}
                  {o.action === "BUY" ? "Buy" : "Sell"}
                </td>
                <td className="num px-2 py-2 text-right">{price(o.price_cents)}</td>
                <td className="num px-2 py-2 text-right">
                  {o.filled}/{o.quantity}
                </td>
                <td className="num px-2 py-2 text-muted">{timeShort(o.created_at)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    className="btn bg-sunken px-2 py-1 text-xs hover:bg-line"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(o.id)}
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No open orders
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
