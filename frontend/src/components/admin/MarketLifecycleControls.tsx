import { api } from "../../api/client";
import type { Market, MarketStatus } from "../../api/types";
import { useAction } from "../../hooks/queries";
import { STATUS_LABEL } from "../../lib/format";

const FLOW: MarketStatus[] = ["DRAFT", "PRICE_DISCOVERY", "SCHOLARSHIP_LOCKED", "TRADING", "CLOSED", "RESOLVED", "SETTLED"];

export function MarketLifecycleControls({ market }: { market: Market }) {
  const open = useAction(api.admin.open);
  const start = useAction(api.admin.startTrading);
  const close = useAction(api.admin.close);
  const settle = useAction(api.admin.settle);
  const current = FLOW.indexOf(market.status);
  const error = open.error ?? start.error ?? close.error ?? settle.error;

  return (
    <div className="card p-5">
      <div className="card-title mb-4">Market lifecycle</div>
      <ol className="flex flex-wrap items-center gap-1 text-[11px]">
        {FLOW.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span
              className={`rounded-full px-2 py-1 ${
                i === current ? "bg-brand font-semibold text-white" : i < current ? "bg-line text-body" : "bg-sunken text-muted"
              }`}
            >
              {STATUS_LABEL[s]}
            </span>
            {i < FLOW.length - 1 && <span className="text-faint">→</span>}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Btn show={market.status === "DRAFT"} onClick={() => open.mutate(market.id)}>
          Open market
        </Btn>
        <Btn show={market.status === "SCHOLARSHIP_LOCKED"} onClick={() => start.mutate(market.id)}>
          Start trading
        </Btn>
        <Btn show={market.status === "TRADING"} onClick={() => close.mutate(market.id)}>
          Close trading (cancel all open orders)
        </Btn>
        <Btn show={market.status === "RESOLVED"} onClick={() => settle.mutate(market.id)} primary>
          Run final settlement
        </Btn>
        {market.status === "PRICE_DISCOVERY" && <span className="text-xs text-muted">↓ Lock the scholarship probability below</span>}
        {market.status === "SETTLED" && <span className="text-xs text-muted">This market has been settled</span>}
      </div>
      {error && <p className="mt-3 text-xs text-no">{error.message}</p>}
    </div>
  );
}

function Btn({ show, onClick, primary, children }: { show: boolean; onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <button type="button" onClick={onClick} className={`btn ${primary ? "bg-brand text-white hover:bg-brand-strong" : "border border-line bg-surface text-ink hover:bg-sunken"}`}>
      {children}
    </button>
  );
}
