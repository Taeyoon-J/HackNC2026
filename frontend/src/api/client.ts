import { useSession } from "../store/user";
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
  MyStudent,
  AdminStudent,
  DisclosureType,
  Contract,
  Action,
  OrderType,
  DirectoryFilters,
  DirectoryPage,
  AdminStudentDetail,
} from "./types";

export class ApiError extends Error {}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(useSession.getState().userId ? { "X-User-Id": useSession.getState().userId! } : {}),
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

export interface ProfileInput {
  university: string;
  year: string;
  major: string;
  introduction?: string;
  pitch?: string;
}

function directoryPath(path: string, filters: DirectoryFilters) {
  const query = new URLSearchParams({ ...filters, page: String(filters.page), page_size: "24", paged: "true" });
  return `${path}?${query}`;
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
  searchMarkets: (filters: DirectoryFilters) => request<DirectoryPage<Market>>("GET", directoryPath("/api/markets", filters)),
  market: (id: string) => request<Market>("GET", `/api/markets/${id}`),
  orderbook: (id: string) => request<OrderBook>("GET", `/api/markets/${id}/orderbook`),
  trades: (id: string) => request<Trade[]>("GET", `/api/markets/${id}/trades`),
  history: (id: string) => request<HistoryPoint[]>("GET", `/api/markets/${id}/history`),
  student: (id: string) => request<StudentProfile>("GET", `/api/students/${id}`),
  createStudent: (p: ProfileInput) => request<{ id: string; user_id: string; name: string }>("POST", "/api/students", p),
  me: {
    student: () => request<MyStudent>("GET", "/api/me/student"),
    updateProfile: (p: ProfileInput) => request<MyStudent>("PUT", "/api/me/student", p),
    saveDisclosure: ({ type, data }: { type: DisclosureType; data: unknown }) =>
      request<MyStudent>("PUT", `/api/me/student/disclosures/${type}`, { data }),
    proposeGoal: (g: { threshold: number; term: string }) => request<MyStudent>("POST", "/api/me/goals", g),
  },
  portfolio: () => request<Portfolio>("GET", "/api/portfolio"),
  placeOrder: (o: NewOrder) => request<OrderResult>("POST", "/api/orders", o),
  cancelOrder: (id: number) => request<Order>("DELETE", `/api/orders/${id}`),
  admin: {
    markets: () => request<Market[]>("GET", "/api/admin/markets"),
    searchMarkets: (filters: DirectoryFilters) => request<DirectoryPage<Market>>("GET", directoryPath("/api/admin/markets", filters)),
    searchStudents: (filters: DirectoryFilters) => request<DirectoryPage<AdminStudent>>("GET", directoryPath("/api/admin/students", filters)),
    student: (id: string) => request<AdminStudentDetail>("GET", `/api/admin/students/${id}`),
    students: () => request<AdminStudent[]>("GET", "/api/admin/students"),
    verifyStudent: (id: string) => request<AdminStudent>("POST", `/api/admin/students/${id}/verify`),
    delistStudent: (id: string) => request<AdminStudent>("POST", `/api/admin/students/${id}/delist`),
    restoreStudent: (id: string) => request<AdminStudent>("POST", `/api/admin/students/${id}/restore`),
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
