import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Contract } from "../api/types";
import { MarketHeader } from "../components/market/MarketHeader";
import { PriceChart } from "../components/market/PriceChart";
import { TradeTape } from "../components/market/TradeTape";
import { StudentProfileCard } from "../components/student/StudentProfileCard";
import { OpenOrdersTable } from "../components/trading/OpenOrdersTable";
import { OrderBook } from "../components/trading/OrderBook";
import { OrderPanel } from "../components/trading/OrderPanel";
import { useHistory, useMarket, useOrderBook, usePortfolio, useTrades } from "../hooks/queries";
import { useMarketSocket } from "../hooks/useMarketSocket";
import { usd } from "../lib/format";

export function MarketPage() {
  const { id = "" } = useParams();
  useMarketSocket(id);
  const { data: market, error } = useMarket(id);
  const { data: book } = useOrderBook(id);
  const { data: trades = [] } = useTrades(id);
  const { data: history = [] } = useHistory(id);
  const { data: portfolio } = usePortfolio();
  const [contract, setContract] = useState<Contract>("YES");
  const [price, setPrice] = useState(50);

  useEffect(() => {
    if (market?.last_price != null) setPrice(market.last_price);
    // Only seed the price once per market, not on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market?.id]);

  if (error) return <p className="text-no">{error.message}</p>;
  if (!market) return <div className="card h-96 animate-pulse" />;

  const switchContract = (c: Contract) => {
    if (c !== contract) setPrice(100 - price);
    setContract(c);
  };
  const myOrders = portfolio?.open_orders.filter((o) => o.market_id === id) ?? [];

  return (
    <div className="space-y-4">
      <Link to="/" className="text-xs text-muted hover:text-ink">
        ← All students
      </Link>
      <MarketHeader market={market} />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="card p-4">
            <div className="card-title mb-2 flex justify-between">
              <span>{contract} price history</span>
              <span className="num font-normal normal-case tracking-normal text-muted">
                {market.minted_pairs?.toLocaleString()} pairs minted · collateral {usd(market.collateral_cents)}
              </span>
            </div>
            <PriceChart points={history} showNo={contract === "NO"} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <OrderBook book={book} view={contract} onPick={setPrice} />
            <TradeTape trades={trades} showNo={contract === "NO"} />
          </div>
          <OpenOrdersTable orders={myOrders} />
        </div>
        <div className="space-y-4">
          <OrderPanel
            market={market}
            contract={contract}
            onContractChange={switchContract}
            price={price}
            onPriceChange={setPrice}
          />
          <StudentProfileCard studentId={market.student.id} threshold={market.threshold} />
        </div>
      </div>
    </div>
  );
}
