import type { HistoryPoint } from "../api/types";

const DAY = 86400;
export type HistoryStep = "hour" | "day" | "week" | "month";

/** Applies the same last-price-per-time-bucket rule used by the detailed market chart. */
export function bucketHistory(points: HistoryPoint[], start: number, end: number, step: HistoryStep, now: number) {
  const buckets = new Map<number, { price: number; quantity: number }>();
  const unit = step === "hour" ? 3600 : step === "week" ? 7 * DAY : DAY;
  for (const point of [...points].filter((p) => p.t >= start && p.t <= end && p.t <= now).sort((a, b) => a.t - b.t)) {
    const date = new Date(point.t * 1000);
    const bucket = step === "month"
      ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000
      : Math.floor(point.t / unit) * unit;
    const previous = buckets.get(bucket);
    buckets.set(bucket, { price: point.price, quantity: (previous?.quantity ?? 0) + point.quantity });
  }
  return [...buckets.entries()].map(([time, row]) => ({ time: Math.max(start, time), ...row }));
}

export function fivePercentPriceDomain(current: number) {
  const low = Math.max(0, current * 0.95);
  return [low, Math.max(low + 1, current * 1.05)] as const;
}
