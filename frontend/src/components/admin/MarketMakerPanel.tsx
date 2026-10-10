import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { LiquidityRow } from "../../api/types";
import { price, timeShort } from "../../lib/format";

const BATCH = 5;
const STEP_MS = 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Admin view of the automatic market maker: run it now (it normally waits for 72 idle
 * hours), see how each student's quotes were priced, and which quotes are resting.
 * Without a market, one press quotes the next BATCH markets one per second (least
 * recently quoted first), so repeated presses rotate through every student.
 */
export function MarketMakerPanel({ marketId }: { marketId?: string }) {
  const { data: resting = [] } = useQuery({
    queryKey: ["admin", "liquidity", marketId ?? "all"],
    queryFn: () => api.admin.liquidity(marketId),
  });
  const qc = useQueryClient();
  const [report, setReport] = useState<LiquidityRow[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setReport([]);
    setError(null);
    try {
      const queue = marketId
        ? [{ market_id: marketId, student: null }]
        : (await api.admin.liquidityQueue(BATCH)).map((q) => ({ market_id: q.market_id, student: q.student.name }));
      for (let i = 0; i < queue.length; i++) {
        setProgress({ done: i, total: queue.length, current: queue[i].student ?? "this market" });
        const { quoted } = await api.admin.runLiquidity(queue[i].market_id);
        setReport((prev) => [...quoted, ...(prev ?? [])]);
        qc.invalidateQueries({ queryKey: ["admin", "liquidity"] });
        if (i < queue.length - 1) await sleep(STEP_MS);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
      qc.invalidateQueries();
    }
  };

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Market maker</h2>
          <p className="max-w-xl text-xs text-muted">
            Runs on its own after 72 hours without trades: it offers the admin-reserve shares one tick above the
            current price (plus a bonus for strong course progress) and bids one tick below.
            {!marketId && " Each press quotes the next 5 students, one per second, least recently quoted first."}
          </p>
        </div>
        <button
          type="button"
          className="btn bg-brand text-white hover:bg-brand-strong"
          disabled={!!progress}
          onClick={run}
        >
          {progress ? `Quoting ${progress.done + 1}/${progress.total}…` : marketId ? "Provide liquidity now" : `Run market maker (next ${BATCH})`}
        </button>
      </div>
      {error && <p className="text-xs text-no">{error}</p>}
      {progress && (
        <div className="space-y-1">
          <p className="text-xs text-brand">Market maker is quoting {progress.current}…</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${((progress.done + 1) / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {report && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">
            {progress ? "Live" : "Just now"} · {report.length ? `quoted ${report.length} market${report.length > 1 ? "s" : ""}` : progress ? "starting…" : "nothing to quote"}
          </h3>
          <div className="space-y-2">
            {report.slice(0, 25).map((r) => (
              <ReportRow key={r.market_id} row={r} />
            ))}
            {report.length > 25 && <p className="text-xs text-muted">…and {report.length - 25} more markets.</p>}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Resting market-maker quotes ({resting.length})</h3>
        {resting.length === 0 ? (
          <p className="text-xs text-muted">No market-maker quotes are resting right now.</p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface text-left text-muted">
                <tr>
                  <th className="py-2 pr-2 font-semibold">Student</th>
                  <th className="px-2 font-semibold">Last price</th>
                  <th className="px-2 font-semibold">Selling</th>
                  <th className="px-2 font-semibold">Buying</th>
                  <th className="px-2 font-semibold">Quoted</th>
                </tr>
              </thead>
              <tbody>
                {resting.map((r) => (
                  <tr key={r.market_id} className="border-t border-line">
                    <td className="py-2 pr-2">
                      <Link to={`/admin?market=${r.market_id}`} className="font-semibold text-ink hover:underline">
                        {r.student.name}
                      </Link>
                    </td>
                    <td className="num px-2">{price(r.current_cents)}</td>
                    <td className="num px-2 text-no">{side(r.ask_qty, r.ask_filled, r.ask_cents)}</td>
                    <td className="num px-2 text-yes">{side(r.bid_qty, r.bid_filled, r.bid_cents)}</td>
                    <td className="num px-2 text-muted">{r.quoted_at ? timeShort(r.quoted_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function side(qty: number, filled: number, cents: number | null) {
  if (!qty || cents == null) return "—";
  return `${qty - filled} @ ${price(cents)}${filled ? ` (${filled} filled)` : ""}`;
}

function ReportRow({ row: r }: { row: LiquidityRow }) {
  return (
    <div className="mm-in rounded-xl bg-sunken p-3 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link to={`/admin?market=${r.market_id}`} className="text-sm font-semibold text-ink hover:underline">
          {r.student.name}
        </Link>
        <span className="text-muted">
          {r.idle_hours != null && `last trade ${r.idle_hours}h ago · `}course progress {r.progress_pct != null ? `${r.progress_pct}%` : "not reported"}
        </span>
      </div>
      <div className="mt-1 grid gap-1 sm:grid-cols-2">
        <span>
          <b className="text-no">Sell</b>{" "}
          {r.ask_qty ? (
            <>
              {r.ask_qty} reserve shares @ <b>{price(r.ask_cents)}</b>
              <span className="text-muted">
                {" "}= {price(r.current_cents)} + tick {price(r.tick_cents)}
                {r.adjustment_cents ? ` + progress ${price(r.adjustment_cents)}` : ""}
              </span>
              {r.ask_filled ? <span className="text-yes"> · {r.ask_filled} filled</span> : null}
            </>
          ) : (
            <span className="text-muted">no reserve shares left</span>
          )}
        </span>
        <span>
          <b className="text-yes">Buy</b>{" "}
          {r.bid_qty ? (
            <>
              {r.bid_qty} shares @ <b>{price(r.bid_cents)}</b>
              {r.bid_filled ? <span className="text-yes"> · {r.bid_filled} filled</span> : null}
            </>
          ) : (
            <span className="text-muted">no bid (market-maker cash)</span>
          )}
        </span>
      </div>
    </div>
  );
}
