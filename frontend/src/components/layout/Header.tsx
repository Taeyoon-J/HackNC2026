import { NavLink } from "react-router-dom";
import { useUserStore } from "../../store/user";
import { UserSwitcher } from "./UserSwitcher";
import { WalletBadge } from "./WalletBadge";

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-semibold ${isActive ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"}`;

export function Header() {
  const userId = useUserStore((s) => s.userId);
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M2 9l10-5 10 5-10 5L2 9z" strokeLinejoin="round" />
              <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" strokeLinejoin="round" />
              <path d="M22 9v6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block font-display text-lg font-semibold text-ink">Student Performance Exchange</span>
            <span className="block text-[11px] text-muted">Community-backed scholarships</span>
          </span>
        </NavLink>
        <nav className="flex gap-1">
          <NavLink to="/" end className={link}>
            Students
          </NavLink>
          <NavLink to="/portfolio" className={link}>
            Portfolio
          </NavLink>
          <NavLink to="/admin" className={link}>
            Admin
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {userId !== "ADMIN" && <WalletBadge />}
          <UserSwitcher />
        </div>
      </div>
    </header>
  );
}
