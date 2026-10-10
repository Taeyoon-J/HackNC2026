import { create } from "zustand";

interface UserState {
  userId: string;
  setUserId: (id: string) => void;
}

const KEY = "spe.userId";

function initial(): string {
  try {
    return localStorage.getItem(KEY) ?? "TRADER_A";
  } catch {
    return "TRADER_A";
  }
}

export const useUserStore = create<UserState>((set) => ({
  userId: initial(),
  setUserId: (id) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* storage unavailable: keep in memory only */
    }
    set({ userId: id });
  },
}));
