import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useSession } from "../store/user";

export const useUsers = () => useQuery({ queryKey: ["users"], queryFn: api.users });
export const useMarkets = () => useQuery({ queryKey: ["markets"], queryFn: api.markets });
export const useMarket = (id: string) => useQuery({ queryKey: ["market", id], queryFn: () => api.market(id), enabled: !!id });
export const useOrderBook = (id: string) =>
  useQuery({ queryKey: ["market", id, "orderbook"], queryFn: () => api.orderbook(id) });
export const useTrades = (id: string) =>
  useQuery({ queryKey: ["market", id, "trades"], queryFn: () => api.trades(id) });
export const useHistory = (id: string) =>
  useQuery({ queryKey: ["market", id, "history"], queryFn: () => api.history(id) });
export const useStudent = (id: string | undefined) =>
  useQuery({ queryKey: ["student", id], queryFn: () => api.student(id!), enabled: !!id });

export function usePortfolio() {
  const userId = useSession((s) => s.userId);
  return useQuery({ queryKey: ["portfolio", userId], queryFn: api.portfolio, enabled: !!userId });
}

export function useMyStudent() {
  const userId = useSession((s) => s.userId);
  return useQuery({ queryKey: ["me", userId], queryFn: api.me.student, enabled: !!userId });
}

export const useAdminMarkets = () => useQuery({ queryKey: ["admin", "markets"], queryFn: api.admin.markets });
export const useAdminStudents = () => useQuery({ queryKey: ["admin", "students"], queryFn: api.admin.students });

/** Mutation that refreshes everything afterwards; the WebSocket also does this for other clients. */
export function useAction<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries() });
}
