import type { MarketStatus } from "../../api/types";
import { STATUS_LABEL } from "../../lib/format";

const STYLE: Record<MarketStatus, string> = {
  DRAFT: "bg-sunken text-body",
  PRICE_DISCOVERY: "bg-brand-soft text-brand",
  SCHOLARSHIP_LOCKED: "bg-gold-soft text-gold",
  TRADING: "bg-yes-soft text-yes",
  CLOSED: "bg-sunken text-body",
  RESOLVED: "bg-violet-100 text-violet-700",
  SETTLED: "bg-sunken text-muted",
};

export function MarketStatusBadge({ status }: { status: MarketStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
