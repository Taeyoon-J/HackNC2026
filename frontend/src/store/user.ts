import { create } from "zustand";

export type Role = "STUDENT" | "TRADER" | "ADMIN";

interface Session {
  userId: string | null;
  role: Role | null;
  login: (userId: string, role: Role) => void;
  logout: () => void;
}

const KEY = "spe.session";

function load(): Pick<Session, "userId" | "role"> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* storage unavailable */
  }
  return { userId: null, role: null };
}

function save(value: Pick<Session, "userId" | "role">) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable: session lives in memory only */
  }
}

/** Demo session: account selection or credential login stores the user ID and role. */
export const useSession = create<Session>((set) => ({
  ...load(),
  login: (userId, role) => {
    save({ userId, role });
    set({ userId, role });
  },
  logout: () => {
    save({ userId: null, role: null });
    set({ userId: null, role: null });
  },
}));

export const ROLE_HOME: Record<Role, string> = {
  STUDENT: "/student",
  TRADER: "/markets",
  ADMIN: "/admin/verification",
};
