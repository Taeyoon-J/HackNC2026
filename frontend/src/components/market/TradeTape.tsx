import type { Trade, TradeType } from "../../api/types";
import { timeShort } from "../../lib/format";

const TYPE_LABEL: Record<TradeType, { text: string; cls: string }> = {
  MINT: { text: "Mint", cls: "text-brand" },
  TRANSFER_YES: { text: "YES transfer", cls: "text-body" },
  TRANSFER_NO: { text: "NO transfer", cls: "text-body" },
  BURN: { text: "Burn", cls: "text-gold" },
};

export function TradeTape({ trades, showNo = false }: { trades: Trade[]; showNo?: boolean }) {
  return (
    <div className="card flex flex-col">
      <div className="card-title border-b border-line px-4 py-3">Trades</div>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-normal">{showNo ? "NO" : "YES"} price</th>
              <th className="px-2 py-2 text-right font-normal">Qty</th>
              <th className="px-2 py-2 text-left font-normal">Type</th>
              <th className="px-4 py-2 text-right font-normal">Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => {
              const buyYes = t.taker_side === "BID";
              const up = showNo ? !buyYes : buyYes;
              return (
                <tr key={t.id} className="border-t border-line">
                  <td className={`num px-4 py-1.5 font-medium ${up ? "text-yes" : "text-no"}`}>
                    {showNo ? 100 - t.yes_price : t.yes_price}¢
                  </td>
                  <td className="num px-2 py-1.5 text-right">{t.quantity}</td>
                  <td className={`px-2 py-1.5 ${TYPE_LABEL[t.trade_type].cls}`}>{TYPE_LABEL[t.trade_type].text}</td>
                  <td className="num px-4 py-1.5 text-right text-muted">{timeShort(t.executed_at)}</td>
                </tr>
              );
            })}
            {trades.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No trades yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
