import { BalanceSummary } from "../../components/portfolio/BalanceSummary";
import { PositionsTable } from "../../components/portfolio/PositionsTable";
import { SettlementHistory } from "../../components/portfolio/SettlementHistory";
import { OpenOrdersTable } from "../../components/trading/OpenOrdersTable";
import { usePortfolio } from "../../hooks/queries";

export function PortfolioPage() {
  const { data: p } = usePortfolio();
  if (!p) return <div className="card h-64 animate-pulse" />;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{p.user.display_name}</h1>
        <p className="text-sm text-muted">
          {p.user.role === "STUDENT" ? "Scholarships are paid to this wallet when goals are met." : "Virtual USD credits"}
        </p>
      </div>
      <BalanceSummary p={p} />
      <PositionsTable positions={p.positions} />
      <OpenOrdersTable orders={p.open_orders} showMarket />
      <SettlementHistory rows={p.settlements} />
    </div>
  );
}
