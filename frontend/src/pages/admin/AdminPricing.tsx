import { useSearchParams } from "react-router-dom";
import { MarketLifecycleControls } from "../../components/admin/MarketLifecycleControls";
import { ScholarshipSummary } from "../../components/admin/ScholarshipSummary";
import { Link } from "react-router-dom";
import { MarketStatusBadge } from "../../components/market/MarketStatusBadge";
import { useMarket } from "../../hooks/queries";
import { api } from "../../api/client";
import { DirectoryPagination, DirectorySearch, MARKET_STATES, useDirectory } from "../../components/student/DirectorySearch";
import { StudentProfileCard } from "../../components/student/StudentProfileCard";

export function AdminPricing() {
  const [params, setParams] = useSearchParams();
  const directory = useDirectory("admin-markets-directory", api.admin.searchMarkets);
  const markets = directory.data?.items ?? [];
  const requestedId = params.get("market") ?? "";
  const { data: requested, error: requestedError } = useMarket(requestedId);
  const market = requestedId ? markets.find((m) => m.id === requestedId) ?? requested : markets[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Markets & scholarships</h1>
        <p className="text-sm text-muted">Initial scholarships are assigned automatically. Approve final GPA in Verification to settle.</p>
      </div>
      <DirectorySearch directory={directory} states={MARKET_STATES} />
      {(directory.error ?? requestedError) && <p className="text-sm text-no">{(directory.error ?? requestedError)?.message}</p>}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="card self-start p-2">
          {directory.isLoading && <p className="p-3 text-sm text-muted">Loading goals…</p>}
          {!directory.isLoading && markets.length === 0 && <p className="p-3 text-sm text-muted">No goals match your search.</p>}
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
          <DirectoryPagination directory={directory} />
        </div>
        {market && (
          <div className="space-y-4">
            <div className="px-1 font-display text-lg text-ink">{market.question}</div>
            <MarketLifecycleControls market={market} />
            <ScholarshipSummary market={market} />
            <Link to="/admin/verification" className="block text-sm font-semibold text-brand">Review final GPA and evidence in Verification →</Link>
            <StudentProfileCard key={market.student.id} studentId={market.student.id} threshold={market.threshold} admin />
          </div>
        )}
      </div>
    </div>
  );
}
