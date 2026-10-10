import { MarketCard } from "../../components/market/MarketCard";
import { api } from "../../api/client";
import { DirectoryPagination, DirectorySearch, MARKET_STATES, useDirectory } from "../../components/student/DirectorySearch";
import { usd } from "../../lib/format";

export function MarketDirectory({ favorites = false }: { favorites?: boolean }) {
  const directory = useDirectory(favorites ? "favorites-directory" : "markets-directory", favorites ? api.searchFavoriteMarkets : api.searchMarkets);
  const { data, isLoading, error } = directory;
  const markets = data?.items ?? [];
  const pledged = data?.summary.pledged_cents ?? 0;
  const paid = data?.summary.paid_cents ?? 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-3xl bg-gradient-to-br from-brand-soft via-surface to-gold-soft p-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            {favorites ? "Your favorites." : "Back students."} <span className="text-brand">{favorites ? "Keep your shortlist close." : "Reward real progress."}</span>
          </h1>
          <p className="mt-3 max-w-xl text-body">
            Share your forecast on whether a student will reach their academic goal. Each student starts with a
            scholarship that is adjusted by the final YES price after their grades are verified.
          </p>
          <p className="mt-3 text-xs text-muted">Virtual credits only · Students are anonymous · All data is synthetic</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Listed goals" value={String(data?.total_all ?? 0)} />
          <Stat label="Pledged" value={usd(pledged, 0)} accent />
          <Stat label="Paid out" value={usd(paid, 0)} accent />
        </div>
      </section>


      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-ink">{favorites ? "Favorite students" : "Students"}</h2>
        <div className="mb-4"><DirectorySearch directory={directory} states={MARKET_STATES.filter((s) => s.value !== "DRAFT")} /></div>
        {error && <p className="mb-4 text-sm text-no">{error.message}</p>}
        {!isLoading && markets.length === 0 && <p className="card p-8 text-center text-muted">No students match your search. Try another university or clear the filters.</p>}
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card h-72 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {markets.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        )}
        <DirectoryPagination directory={directory} />
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface/80 p-4 text-center">
      <div className={`num font-display text-2xl font-semibold ${accent ? "text-gold" : "text-ink"}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}
