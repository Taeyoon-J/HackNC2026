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
  Account, GpaAverage, Verification, VerificationInput, VerificationPage,
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

export interface RegistrationInput extends ProfileInput {
  username: string;
  password: string;
  academic_history: { terms: { term: string; courses: import("./types").CourseRecord[] }[] };
  current_course_load: { term: string; courses: import("./types").CourseRecord[] };
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
  searchFavoriteMarkets: (filters: DirectoryFilters) => request<DirectoryPage<Market>>("GET", `${directoryPath("/api/markets", filters)}&favorites=true`),
  gpaAverages: () => request<GpaAverage[]>("GET", "/api/students/gpa-averages"),
  favorites: {
    list: () => request<string[]>("GET", "/api/favorites"),
    add: (id: string) => request<{ favorite: boolean }>("PUT", `/api/favorites/${id}`),
    remove: (id: string) => request<{ favorite: boolean }>("DELETE", `/api/favorites/${id}`),
  },
  account: {
    get: () => request<Account>("GET", "/api/account"),
    update: (input: { username: string; password: string; current_password: string }) => request<Account>("PUT", "/api/account", input),
    login: (input: { username: string; password: string }) => request<{ user_id: string; role: User["role"] }>("POST", "/api/account/login", input),
  },
  market: (id: string) => request<Market>("GET", `/api/markets/${id}`),
  orderbook: (id: string) => request<OrderBook>("GET", `/api/markets/${id}/orderbook`),
  trades: (id: string) => request<Trade[]>("GET", `/api/markets/${id}/trades`),
  history: (id: string) => request<HistoryPoint[]>("GET", `/api/markets/${id}/history`),
  student: (id: string) => request<StudentProfile>("GET", `/api/students/${id}`),
  createStudent: (p: RegistrationInput) => request<{ id: string; user_id: string; name: string; message: string }>("POST", "/api/students", p),
  me: {
    verifications: () => request<Verification[]>("GET", "/api/me/verifications"),
    submitVerification: (input: VerificationInput) => request<Verification>("POST", "/api/me/verifications", input),
    student: () => request<MyStudent>("GET", "/api/me/student"),
    updateProfile: (p: ProfileInput) => request<MyStudent>("PUT", "/api/me/student", p),
    saveDisclosure: ({ type, data }: { type: DisclosureType; data: unknown }) =>
      request<MyStudent>("PUT", `/api/me/student/disclosures/${type}`, { data }),
    saveCourseProgress: (input: { courses: { code: string; assessments: { title: string; category: string; earned: number; possible: number; date?: string }[] }[] }) =>
      request<MyStudent>("PUT", "/api/me/student/course-progress", input),
  },
  portfolio: () => request<Portfolio>("GET", "/api/portfolio"),
  placeOrder: (o: NewOrder) => request<OrderResult>("POST", "/api/orders", o),
  cancelOrder: (id: number) => request<Order>("DELETE", `/api/orders/${id}`),
  admin: {
    verifications: (filters: { q: string; type: string; status: string; page: number }) =>
      request<VerificationPage>("GET", `/api/admin/verifications?${new URLSearchParams({ ...filters, page: String(filters.page) })}`),
    verification: (id: number) => request<Verification>("GET", `/api/admin/verifications/${id}`),
    approveVerification: ({ id, note }: { id: number; note: string }) => request<Verification>("POST", `/api/admin/verifications/${id}/approve`, { note }),
    rejectVerification: ({ id, note }: { id: number; note: string }) => request<Verification>("POST", `/api/admin/verifications/${id}/reject`, { note }),
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
