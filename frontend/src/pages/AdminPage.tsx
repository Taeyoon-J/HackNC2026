import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { DemoGuide } from "../components/admin/DemoGuide";
import { InvariantsPanel } from "../components/admin/InvariantsPanel";
import { MarketLifecycleControls } from "../components/admin/MarketLifecycleControls";
import { ResolvePanel } from "../components/admin/ResolvePanel";
import { ScholarshipLockPanel } from "../components/admin/ScholarshipLockPanel";
import { MarketStatusBadge } from "../components/market/MarketStatusBadge";
import { useAction, useMarket, useMarkets } from "../hooks/queries";
import { useUserStore } from "../store/user";

export function AdminPage() {
  const { userId, setUserId } = useUserStore();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const marketId = params.get("market") ?? "STU001-GPA-2026F";
  const { data: markets = [] } = useMarkets();
  const { data: market } = useMarket(marketId);
  const reset = useAction(api.admin.reset);
  const isAdmin = userId === "ADMIN";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Admin</h1>
        {isAdmin && (
          <button
            type="button"
            className="btn border border-line text-body hover:bg-sunken"
            onClick={() => confirm("Reset all data to the seed state?") && reset.mutate(undefined)}
          >
            {reset.isPending ? "Resetting…" : "Reset demo data"}
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="flex items-center justify-between rounded-xl border border-gold/30 bg-gold-soft px-4 py-3 text-sm text-gold">
          Admin actions require the Admin account.
          <button
            type="button"
            className="btn bg-gold text-white hover:bg-gold/90"
            onClick={() => {
              setUserId("ADMIN");
              qc.invalidateQueries();
            }}
          >
            Switch to Admin
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <DemoGuide />
          {isAdmin && <InvariantsPanel />}
        </div>
        <div className="space-y-4">
          <div className="card p-2">
            <div className="flex flex-wrap gap-1">
              {markets.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setParams({ market: m.id })}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
                    m.id === marketId ? "bg-sunken text-ink" : "text-muted hover:bg-sunken"
                  }`}
                >
                  <span className="font-mono">{m.id.split("-")[0]}</span>
                  <MarketStatusBadge status={m.status} />
                </button>
              ))}
            </div>
          </div>
          {market && isAdmin && (
            <>
              <div className="px-1 text-sm text-body">{market.question}</div>
              <MarketLifecycleControls market={market} />
              <ScholarshipLockPanel market={market} />
              <ResolvePanel market={market} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
