import { usePortfolio } from "../../hooks/queries";
import { usd } from "../../lib/format";

export function WalletBadge() {
  const { data } = usePortfolio();
  if (!data) return null;
  return (
    <div className="hidden border-r border-line pr-3 text-right text-xs leading-tight sm:block">
      <div className="num font-semibold text-ink">{usd(data.available_cents)}</div>
      <div className="num text-muted">Reserved {usd(data.reserved_cents)}</div>
    </div>
  );
}
