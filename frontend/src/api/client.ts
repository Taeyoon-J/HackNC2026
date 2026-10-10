import { useUserStore } from "../store/user";
import type {
  HistoryPoint,
  InvariantCheck,
  LockPreview,
  Market,
  OrderBook,
  OrderResult,
  Order,
  Portfolio,
  StudentProfile,
  Trade,
  User,
  Contract,
  Action,
  OrderType,
} from "./types";

export class ApiError extends Error {}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": useUserStore.getState().userId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail ?? data);
    throw new ApiError(detail || res.statusText);
  }
  return data as T;
}

export interface NewOrder {
  market_id: string;
  contract: Contract;
  action: Action;
  order_type: OrderType;
  price_cents: number | null;
  quantity: number;
}

export const api = {
  users: () => request<User[]>("GET", "/api/users"),
  markets: () => request<Market[]>("GET", "/api/markets"),
  market: (id: string) => request<Market>("GET", `/api/markets/${id}`),
  orderbook: (id: string) => request<OrderBook>("GET", `/api/markets/${id}/orderbook`),
  trades: (id: string) => request<Trade[]>("GET", `/api/markets/${id}/trades`),
  history: (id: string) => request<HistoryPoint[]>("GET", `/api/markets/${id}/history`),
  student: (id: string) => request<StudentProfile>("GET", `/api/students/${id}`),
  portfolio: () => request<Portfolio>("GET", "/api/portfolio"),
  placeOrder: (o: NewOrder) => request<OrderResult>("POST", "/api/orders", o),
  cancelOrder: (id: number) => request<Order>("DELETE", `/api/orders/${id}`),
  admin: {
    open: (id: string) => request<Market>("POST", `/api/admin/markets/${id}/open`),
    lockPreview: (id: string) => request<LockPreview>("GET", `/api/admin/markets/${id}/lock-preview`),
    lock: (id: string, probability: number | null) =>
      request<Market>("POST", `/api/admin/markets/${id}/lock`, { probability }),
    startTrading: (id: string) => request<Market>("POST", `/api/admin/markets/${id}/start-trading`),
    close: (id: string) => request<Market>("POST", `/api/admin/markets/${id}/close`),
    resolve: (id: string, value: number) =>
      request<Market>("POST", `/api/admin/markets/${id}/resolve`, { value }),
    settle: (id: string) => request<unknown>("POST", `/api/admin/markets/${id}/settle`),
    invariants: () => request<InvariantCheck[]>("GET", "/api/admin/invariants"),
    reset: () => request<unknown>("POST", "/api/admin/reset"),
  },
};
