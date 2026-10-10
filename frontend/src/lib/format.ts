import type { MarketStatus } from "../api/types";

export const usd = (cents: number | null | undefined, digits = 2) =>
  cents == null
    ? "—"
    : (cents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

/** Cent amounts (possibly fractional, e.g. an average cost) shown as dollars. */
export const cents = (c: number | null | undefined) => (c == null ? "—" : usd(Math.round(c)));

export const pct = (p: number | null | undefined) => (p == null ? "—" : `${(p * 100).toFixed(1)}%`);

export const qty = (n: number) => n.toLocaleString("en-US");

export const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export const timeShort = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const STATUS_LABEL: Record<MarketStatus, string> = {
  DRAFT: "Draft",
  PRICE_DISCOVERY: "Price discovery",
  SCHOLARSHIP_LOCKED: "Scholarship locked",
  TRADING: "Trading",
  CLOSED: "Closed",
  RESOLVED: "Resolved",
  SETTLED: "Settled",
};

export const TRADABLE: MarketStatus[] = ["PRICE_DISCOVERY", "SCHOLARSHIP_LOCKED", "TRADING"];

/** Same formula as the backend (spec §6) for live previews. */
export function scholarshipFor(probability: number) {
  const p = Math.max(0.1, probability);
  return Math.min(3000, Math.round(1000 * (0.5 / p) ** 0.75 * 100) / 100);
}

/** Share price in dollars (amounts are stored in cents). */
export const price = (c: number | null | undefined) => (c == null ? "—" : usd(c));

/** Community forecast in percent: last price relative to the value of a share. */
export const chance = (m: { last_price: number | null; share_value_cents?: number }) =>
  m.last_price == null ? null : Math.round((m.last_price / (m.share_value_cents || 100)) * 100);
