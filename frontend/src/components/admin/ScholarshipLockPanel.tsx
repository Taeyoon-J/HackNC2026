import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Market } from "../../api/types";
import { useAction } from "../../hooks/queries";
import { pct, scholarshipFor, usd, price } from "../../lib/format";

export function ScholarshipLockPanel({ market }: { market: Market }) {
  const enabled = market.status === "PRICE_DISCOVERY";
  const { data: preview } = useQuery({
    queryKey: ["market", market.id, "lock-preview"],
    queryFn: () => api.admin.lockPreview(market.id),
    enabled,
  });
  const [percent, setPercent] = useState("");
  useEffect(() => {
    if (preview?.suggested_probability != null) setPercent((preview.suggested_probability * 100).toFixed(1));
  }, [preview?.suggested_probability]);
  const lock = useAction((p: number) => api.admin.lock(market.id, p));

  if (market.scholarship) {
    const s = market.scholarship;
    return (
      <div className="card p-5">
        <div className="card-title mb-3">Scholarship</div>
        <div className="num text-3xl font-bold text-gold">{usd(s.promised_cents)}</div>
        <div className="mt-1 text-xs text-muted">
          Locked at p = {pct(s.probability)} · {s.status} · held in a separate Scholarship Reserve
        </div>
      </div>
    );
  }

  const p = Number(percent) / 100;
  const valid = p > 0 && p < 1;
  return (
    <div className="card p-5">
      <div className="card-title mb-3">Lock scholarship probability</div>
      {!enabled ? (
        <p className="text-sm text-muted">Can only be locked during PRICE_DISCOVERY.</p>
      ) : (
        <>
          {preview && (
            <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
              <Info label="24h VWAP" value={price(preview.vwap_24h)} />
              <Info label="24h trades" value={`${preview.trades_24h} / ${preview.volume_24h} contracts`} />
              <Info
                label="Sufficient?"
                value={preview.sufficient ? "Yes" : `No (need ≥${preview.min_trades} trades)`}
                cls={preview.sufficient ? "text-yes" : "text-no"}
              />
            </div>
          )}
          <label className="text-xs text-muted">Reference probability (%) · VWAP suggestion, admin may override</label>
          <div className="mt-1 flex gap-2">
            <input className="input num" value={percent} onChange={(e) => setPercent(e.target.value)} />
            <button
              type="button"
              disabled={!valid || lock.isPending}
              onClick={() => lock.mutate(p)}
              className="btn whitespace-nowrap bg-gold text-white hover:bg-gold/90"
            >
              Lock
            </button>
          </div>
          <div className="mt-3 rounded-lg bg-sunken p-3 text-xs">
            <div className="text-muted">S = min(3000, 1000 × (0.5 / max(p, 0.1))^0.75)</div>
            <div className="num mt-1 text-lg font-semibold text-gold">
              {valid ? usd(Math.round(scholarshipFor(p) * 100)) : "—"}
            </div>
          </div>
          {lock.error && <p className="mt-2 text-xs text-no">{lock.error.message}</p>}
        </>
      )}
    </div>
  );
}

function Info({ label, value, cls = "text-ink" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-lg bg-sunken p-2">
      <div className="text-muted">{label}</div>
      <div className={`num mt-0.5 font-medium ${cls}`}>{value}</div>
    </div>
  );
}
