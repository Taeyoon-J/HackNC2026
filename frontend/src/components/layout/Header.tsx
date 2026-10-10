import { NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useUsers } from "../../hooks/queries";
import { useSession, type Role } from "../../store/user";
import { WalletBadge } from "./WalletBadge";

const NAV: Record<Role, [string, string][]> = {
  STUDENT: [["/student", "My profile"], ["/student/settings", "Settings"]],
  TRADER: [
    ["/markets", "Markets"],
    ["/favorites", "Favorites"],
    ["/portfolio", "Portfolio"],
    ["/orders", "Orders"],
  ],
  ADMIN: [
    ["/admin/verification", "Verification"],
    ["/admin", "Markets"],
    ["/admin/students", "Students"],
    ["/admin/system", "System"],
  ],
};

const ROLE_LABEL: Record<Role, string> = { STUDENT: "Student", TRADER: "Trader", ADMIN: "Admin" };

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-semibold ${isActive ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"}`;

export function Header() {
  const { userId, role, logout } = useSession();
  const { data: users = [] } = useUsers();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = users.find((u) => u.id === userId);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="hidden leading-tight md:block">
            <span className="block font-display text-lg font-semibold text-ink">Student Performance Exchange</span>
            <span className="block text-[11px] text-muted">Community-backed scholarships</span>
          </span>
        </NavLink>
        {role && (
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {NAV[role].map(([to, label]) => (
              <NavLink key={to} to={to} end className={link}>
                {label}
              </NavLink>
            ))}
          </nav>
        )}
        {role && (
          <div className="ml-auto flex items-center gap-3">
            {role === "TRADER" && <WalletBadge />}
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-ink">{me?.display_name ?? userId}</div>
              <div className="text-[11px] text-muted">{ROLE_LABEL[role]}</div>
            </div>
            <button
              type="button"
              className="btn border border-line bg-surface text-body hover:bg-sunken"
              onClick={() => {
                logout();
                qc.clear();
                navigate("/login");
              }}
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function Logo({ size = "h-9 w-9" }: { size?: string }) {
  return (
    <span className={`grid ${size} place-items-center rounded-full bg-brand text-white`}>
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M2 9l10-5 10 5-10 5L2 9z" strokeLinejoin="round" />
        <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" strokeLinejoin="round" />
        <path d="M22 9v6" strokeLinecap="round" />
      </svg>
    </span>
  );
}
