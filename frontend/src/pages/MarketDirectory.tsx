import { Link } from "react-router-dom";
import { MarketCard } from "../components/market/MarketCard";
import { useMarkets } from "../hooks/queries";
import { usd } from "../lib/format";

export function MarketDirectory() {
  const { data: markets = [], isLoading } = useMarkets();
  const pledged = markets.reduce((s, m) => s + (m.scholarship?.promised_cents ?? 0), 0);
  const paid = markets.reduce((s, m) => s + (m.scholarship?.status === "PAID" ? m.scholarship.promised_cents : 0), 0);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-3xl bg-gradient-to-br from-brand-soft via-surface to-gold-soft p-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            Back students. <span className="text-brand">Reward real progress.</span>
          </h1>
          <p className="mt-3 max-w-xl text-body">
            Share your forecast on whether a student will reach their academic goal. The harder the community thinks a
            goal is, the larger the scholarship the student earns when they achieve it.
          </p>
          <p className="mt-3 text-xs text-muted">Virtual credits only · Students are anonymous · All data is synthetic</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Students" value={String(markets.length)} />
          <Stat label="Pledged" value={usd(pledged, 0)} accent />
          <Stat label="Paid out" value={usd(paid, 0)} accent />
        </div>
      </section>

      <Link
        to="/admin"
        className="flex items-center justify-between rounded-2xl border border-brand/30 bg-surface px-5 py-3 text-sm text-brand hover:bg-brand-soft"
      >
        <span>
          <b>Demo walkthrough</b> — follow Student A from first forecast to scholarship payout
        </span>
        <span aria-hidden>→</span>
      </Link>

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-ink">Students</h2>
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
