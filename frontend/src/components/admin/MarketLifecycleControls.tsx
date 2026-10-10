import { api } from "../../api/client";
import type { Market } from "../../api/types";
import { useAction } from "../../hooks/queries";
import { STATUS_LABEL } from "../../lib/format";

export function MarketLifecycleControls({ market }: { market: Market }) {
  const open = useAction(api.admin.open);
  return <section className="card p-5">
    <h2 className="mb-3 font-semibold text-ink">Market lifecycle</h2>
    <div className="flex flex-wrap items-center gap-2 text-xs">{["Goal submitted", "Trading", "Final GPA verified", "Settled"].map((label, i) => <span key={label} className="rounded-full bg-sunken px-3 py-1 text-body">{i > 0 && "→ "}{label}</span>)}</div>
    <p className="mt-3 text-sm text-muted">Current status: {STATUS_LABEL[market.status]}. {market.total_supply} issued YES shares.</p>
    {market.status === "DRAFT" && <button type="button" className="btn mt-3 bg-brand text-white" disabled={open.isPending} onClick={() => open.mutate(market.id)}>Open verified student's market</button>}
    {open.error && <p className="mt-2 text-sm text-no">{open.error.message}</p>}
    {market.status !== "DRAFT" && market.status !== "SETTLED" && <p className="mt-2 text-xs text-muted">Final GPA approval in Verification cancels pending orders and completes settlement automatically.</p>}
  </section>;
}
