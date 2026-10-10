import { useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Header } from "./components/layout/Header";
import { useMarketSocket, type SocketEvent } from "./hooks/useMarketSocket";
import { AdminPricing } from "./pages/admin/AdminPricing";
import { AdminStudents } from "./pages/admin/AdminStudents";
import { AdminSystem } from "./pages/admin/AdminSystem";
import { LoginPage } from "./pages/LoginPage";
import { StudentHome } from "./pages/student/StudentHome";
import { MarketDirectory } from "./pages/trader/MarketDirectory";
import { MarketPage } from "./pages/trader/MarketPage";
import { PortfolioPage } from "./pages/trader/PortfolioPage";
import { ROLE_HOME, useSession, type Role } from "./store/user";

const TOAST_TEXT: Record<string, (e: SocketEvent) => string | null> = {
  TRADE_EXECUTED: (e) => `${e.market_id.split("-")[0]} filled · ${e.data.quantity} @ YES ${e.data.yes_price}¢ (${e.data.trade_type})`,
  SCHOLARSHIP_LOCKED: (e) => `${e.market_id.split("-")[0]} scholarship locked · $${((e.data.promised_cents as number) / 100).toFixed(2)}`,
  MARKET_SETTLED: (e) => `${e.market_id.split("-")[0]} settled · outcome ${e.data.outcome}`,
};

/** Renders children only for the allowed roles; everyone else goes to their own home. */
function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useSession((s) => s.role);
  if (!role) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to={ROLE_HOME[role]} replace />;
  return <>{children}</>;
}

function Home() {
  const role = useSession((s) => s.role);
  return <Navigate to={role ? ROLE_HOME[role] : "/login"} replace />;
}

export default function App() {
  const role = useSession((s) => s.role);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  useMarketSocket("*", (e) => {
    const text = TOAST_TEXT[e.type]?.(e);
    if (!text) return;
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  });

  if (!role) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Home />} />
          <Route path="/student" element={<RequireRole roles={["STUDENT"]}><StudentHome /></RequireRole>} />
          <Route path="/markets" element={<RequireRole roles={["TRADER"]}><MarketDirectory /></RequireRole>} />
          <Route path="/markets/:id" element={<RequireRole roles={["TRADER", "STUDENT", "ADMIN"]}><MarketPage /></RequireRole>} />
          <Route path="/portfolio" element={<RequireRole roles={["TRADER"]}><PortfolioPage /></RequireRole>} />
          <Route path="/admin" element={<RequireRole roles={["ADMIN"]}><AdminPricing /></RequireRole>} />
          <Route path="/admin/students" element={<RequireRole roles={["ADMIN"]}><AdminStudents /></RequireRole>} />
          <Route path="/admin/system" element={<RequireRole roles={["ADMIN"]}><AdminSystem /></RequireRole>} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-xl border border-line bg-surface px-4 py-2 text-xs text-body shadow-lg">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
