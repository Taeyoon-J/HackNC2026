import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DirectoryFilters, DirectoryPage } from "../../api/types";

export function useDirectory<T>(key: string, fetch: (filters: DirectoryFilters) => Promise<DirectoryPage<T>>) {
  const [filters, setFilters] = useState<DirectoryFilters>({ q: "", university: "", major: "", state: "", page: 1 });
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, q: query, page: 1 })), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const result = useQuery({ queryKey: [key, filters], queryFn: () => fetch(filters), placeholderData: keepPreviousData });
  return { ...result, filters, setFilters, query, setQuery };
}

export function DirectorySearch<T>({ directory, states = [] }: {
  directory: ReturnType<typeof useDirectory<T>>;
  states?: { value: string; label: string }[];
}) {
  const { data, query, setQuery, filters, setFilters, isFetching } = directory;
  const change = (key: keyof DirectoryFilters, value: string) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  return (
    <div className="card space-y-3 p-4">
      <label className="block text-xs font-semibold text-muted">
        Search students
        <input type="search" className="input mt-1" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Student ID, university, major, courses, activities or personal statement" />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted">University
          <select className="input mt-1" value={filters.university} onChange={(e) => change("university", e.target.value)}>
            <option value="">All universities</option>
            {data?.universities.map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">Major
          <select className="input mt-1" value={filters.major} onChange={(e) => change("major", e.target.value)}>
            <option value="">All majors</option>
            {data?.majors.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">Status
          <select className="input mt-1" value={filters.state} onChange={(e) => change("state", e.target.value)}>
            <option value="">All statuses</option>
            {states.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted" aria-live="polite">
        <span>{isFetching ? "Searching…" : `${data?.total ?? 0} results · ${data?.total_all ?? 0} total`}</span>
        <button type="button" className="text-brand hover:underline" onClick={() => {
          setQuery(""); setFilters({ q: "", university: "", major: "", state: "", page: 1 });
        }}>Clear filters</button>
      </div>
    </div>
  );
}

export function DirectoryPagination<T>({ directory }: { directory: ReturnType<typeof useDirectory<T>> }) {
  const { data, filters, setFilters, isFetching } = directory;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size ?? 24)));
  return <div className="flex items-center justify-between gap-3 py-3 text-sm text-muted">
    <button type="button" className="btn border border-line" disabled={filters.page === 1 || isFetching}
      onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>Previous</button>
    <span>Page {filters.page} of {pages}</span>
    <button type="button" className="btn border border-line" disabled={filters.page >= pages || isFetching}
      onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Next</button>
  </div>;
}

export const MARKET_STATES = ["DRAFT", "PRICE_DISCOVERY", "SCHOLARSHIP_LOCKED", "TRADING", "CLOSED", "RESOLVED", "SETTLED"]
  .map((value) => ({ value, label: value.replace(/_/g, " ").toLowerCase() }));
