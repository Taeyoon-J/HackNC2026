import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Header } from "./components/layout/Header";
import { useMarketSocket, type SocketEvent } from "./hooks/useMarketSocket";
import { AdminPage } from "./pages/AdminPage";
import { MarketDirectory } from "./pages/MarketDirectory";
import { MarketPage } from "./pages/MarketPage";
import { PortfolioPage } from "./pages/PortfolioPage";

const TOAST_TEXT: Record<string, (e: SocketEvent) => string | null> = {
  TRADE_EXECUTED: (e) => `${e.market_id.split("-")[0]} filled · ${e.data.quantity} @ YES ${e.data.yes_price}¢ (${e.data.trade_type})`,
  SCHOLARSHIP_LOCKED: (e) => `${e.market_id.split("-")[0]} scholarship locked · $${((e.data.promised_cents as number) / 100).toFixed(2)}`,
  MARKET_SETTLED: (e) => `${e.market_id.split("-")[0]} settled · outcome ${e.data.outcome}`,
};

export default function App() {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  useMarketSocket("*", (e) => {
    const text = TOAST_TEXT[e.type]?.(e);
    if (!text) return;
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/" element={<MarketDirectory />} />
          <Route path="/markets/:id" element={<MarketPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink shadow-xl">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
