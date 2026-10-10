import { useSearchParams } from "react-router-dom";
import { MarketLifecycleControls } from "../../components/admin/MarketLifecycleControls";
import { ResolvePanel } from "../../components/admin/ResolvePanel";
import { ScholarshipLockPanel } from "../../components/admin/ScholarshipLockPanel";
import { MarketStatusBadge } from "../../components/market/MarketStatusBadge";
import { useAdminMarkets } from "../../hooks/queries";

export function AdminPricing() {
  const [params, setParams] = useSearchParams();
  const { data: markets = [] } = useAdminMarkets();
  const market = markets.find((m) => m.id === params.get("market")) ?? markets[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Pricing & outcomes</h1>
        <p className="text-sm text-muted">Open goals, lock scholarship amounts, verify results and settle.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="card self-start p-2">
          {markets.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setParams({ market: m.id })}
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${
                m.id === market?.id ? "bg-brand-soft" : "hover:bg-sunken"
              }`}
            >
              <span>
                <span className="block font-semibold text-ink">
                  {m.student.name}
                  {m.student.status === "DELISTED" && <span className="ml-1 text-xs font-normal text-no">(delisted)</span>}
                </span>
                <span className="block text-xs text-muted">
                  {m.term} · GPA ≥ {m.threshold}
                </span>
              </span>
              <MarketStatusBadge status={m.status} />
            </button>
          ))}
        </div>
        {market && (
          <div className="space-y-4">
            <div className="px-1 font-display text-lg text-ink">{market.question}</div>
            <MarketLifecycleControls market={market} />
            <div className="grid gap-4 xl:grid-cols-2">
              <ScholarshipLockPanel market={market} />
              <ResolvePanel market={market} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
