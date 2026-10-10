import { useState } from "react";
import { api } from "../../api/client";
import type { Market } from "../../api/types";
import { useAction } from "../../hooks/queries";

export function ResolvePanel({ market }: { market: Market }) {
  const [value, setValue] = useState("3.85");
  const resolve = useAction((v: number) => api.admin.resolve(market.id, v));
  const canResolve = market.status === "TRADING" || market.status === "CLOSED";
  const v = Number(value);
  const outcome = v >= market.threshold ? "YES" : "NO";

  return (
    <div className="card p-5">
      <div className="card-title mb-3">Resolve outcome</div>
      {market.outcome ? (
        <div>
          <span className={`text-3xl font-bold ${market.outcome === "YES" ? "text-yes" : "text-no"}`}>{market.outcome}</span>
          <span className="ml-2 text-sm text-muted">
            Verified {market.metric} {market.resolved_value} (target {market.threshold})
          </span>
        </div>
      ) : !canResolve ? (
        <p className="text-sm text-muted">Only TRADING or CLOSED markets can be resolved.</p>
      ) : (
        <>
          <label className="text-xs text-muted">Verified {market.term} {market.metric}</label>
          <div className="mt-1 flex gap-2">
            <input className="input num" value={value} onChange={(e) => setValue(e.target.value)} />
            <button
              type="button"
              disabled={!value || Number.isNaN(v) || resolve.isPending}
              onClick={() => resolve.mutate(v)}
              className="btn whitespace-nowrap bg-violet-600 text-white hover:bg-violet-500"
            >
              Approve result
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            → Outcome <span className={outcome === "YES" ? "text-yes" : "text-no"}>{outcome}</span> (target {market.threshold}).
            If still trading, the market is closed and open orders are cancelled.
          </p>
          {resolve.error && <p className="mt-2 text-xs text-no">{resolve.error.message}</p>}
        </>
      )}
    </div>
  );
}
