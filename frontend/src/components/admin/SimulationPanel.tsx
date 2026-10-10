import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { SimulationEvent } from "../../api/types";
import { useAction } from "../../hooks/queries";
import { price, usd } from "../../lib/format";

const NAMES: Record<string, string> = {
  TRADER_A: "Trader A", TRADER_B: "Trader B", TRADER_C: "Trader C", MM_ALPHA: "Market Maker α", MM_BETA: "Market Maker β",
};
const who = (id: string) => NAMES[id] ?? id;

/** Live 10-minute trading simulation for Students A–E, mirrored to Capital One Nessie. */
export function SimulationPanel() {
  const [useNessie, setUseNessie] = useState(true);
  const { data: s } = useQuery({
    queryKey: ["admin", "simulation"],
    queryFn: api.admin.simulation,
    refetchInterval: (q) => (q.state.data?.running ? 1000 : 5000),
  });
  const start = useAction(api.admin.startSimulation);
  const stop = useAction(api.admin.stopSimulation);
  const error = start.error ?? stop.error;
  const running = !!s?.running;
  const mm = String(Math.floor((s?.remaining_seconds ?? 0) / 60)).padStart(2, "0");
  const ss = String((s?.remaining_seconds ?? 0) % 60).padStart(2, "0");

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Live trading simulation · Students A–E</h2>
          <p className="max-w-2xl text-xs text-muted">
            For 10 minutes, bots (Trader B, Trader C and the two market makers) trade every few seconds through the real
            matching engine. Trader A is left free for you to trade by hand. Each trade is recorded as a Capital One Nessie
            transfer from the buyer.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!running && (
            <label className="flex items-center gap-1.5 text-xs text-body">
              <input type="checkbox" checked={useNessie} disabled={!s?.nessie.configured}
                onChange={(e) => setUseNessie(e.target.checked)} />
              Record in Nessie
            </label>
          )}
          {running ? (
            <button type="button" className="btn border border-no/40 bg-surface text-no hover:bg-no-soft"
              disabled={stop.isPending} onClick={() => stop.mutate(undefined)}>
              Stop
            </button>
          ) : (
            <button type="button" className="btn bg-brand text-white hover:bg-brand-strong" disabled={start.isPending}
              onClick={() => start.mutate({ minutes: 10, nessie: useNessie && !!s?.nessie.configured })}>
              {start.isPending ? "Starting…" : "Start 10-minute simulation"}
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-no">{error.message}</p>}
      {s && !s.nessie.configured && <p className="text-xs text-gold">Nessie is not configured (.env); trades will run without it.</p>}

      {s && (s.running || s.trades > 0) && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label={running ? "Time left" : "Finished"} value={running ? `${mm}:${ss}` : "—"} accent={running} />
            <Stat label="Trades" value={String(s.trades)} />
            <Stat label="Volume" value={usd(s.volume_cents, 0)} />
            <Stat label="New quotes" value={String(s.quotes)} />
            <Stat label="Nessie transfers"
              value={s.nessie.enabled ? `${s.nessie.ok}${s.nessie.queued ? ` (+${s.nessie.queued})` : ""}${s.nessie.failed ? ` · ${s.nessie.failed} failed` : ""}` : "off"} />
          </div>
          {s.nessie.error && <p className="text-xs text-no">Nessie: {s.nessie.error}</p>}

          <div className="grid gap-2 sm:grid-cols-5">
            {s.markets.map((m) => {
              const change = m.price_cents != null && m.start_cents != null ? m.price_cents - m.start_cents : 0;
              return (
                <Link key={m.market_id} to={`/admin?market=${m.market_id}`} className="rounded-xl bg-sunken p-3 hover:bg-brand-soft">
                  <div className="text-xs font-semibold text-ink">{m.student}</div>
                  <div className="num font-display text-lg font-semibold text-ink">{price(m.price_cents)}</div>
                  <div className={`num text-[11px] ${change > 0 ? "text-yes" : change < 0 ? "text-no" : "text-muted"}`}>
                    {change > 0 ? "▲" : change < 0 ? "▼" : "•"} {price(Math.abs(change))} since start
                  </div>
                </Link>
              );
            })}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Trade feed</h3>
            <div className="max-h-80 space-y-1.5 overflow-auto">
              {s.events.length === 0 && <p className="text-xs text-muted">Waiting for the first trade…</p>}
              {s.events.map((e) => <EventRow key={e.id} e={e} />)}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function EventRow({ e }: { e: SimulationEvent }) {
  const badge =
    e.nessie === "off" ? <span className="text-faint">Nessie off</span>
    : e.nessie === "queued" ? <span className="text-gold">Nessie queued…</span>
    : e.nessie === "failed" ? <span className="text-no">Nessie failed</span>
    : <span className="text-yes" title={e.nessie}>✓ Nessie {e.nessie.slice(0, 8)}</span>;
  return (
    <div className="mm-in flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sunken px-3 py-2 text-xs">
      <span>
        <span className="num text-muted">{new Date(e.time).toLocaleTimeString("en-US")}</span>{" "}
        <b className="text-ink">{e.student}</b> · {who(e.buyer)} bought <b>{e.quantity}</b> @ <b>{price(e.price_cents)}</b> from {who(e.seller)}
        <span className="text-muted"> = {usd(e.amount_cents)}</span>
      </span>
      {badge}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-sunken p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`num font-display text-lg font-semibold ${accent ? "text-brand" : "text-ink"}`}>{value}</div>
    </div>
  );
}
