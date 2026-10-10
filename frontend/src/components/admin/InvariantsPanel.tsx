import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";

export function InvariantsPanel() {
  const { data = [], isFetching } = useQuery({ queryKey: ["invariants"], queryFn: api.admin.invariants });
  const ok = data.every((c) => c.ok);
  return (
    <div className="card p-5">
      <div className="card-title mb-3 flex items-center justify-between">
        <span>Invariant checks</span>
        <span className={`normal-case tracking-normal ${ok ? "text-yes" : "text-no"}`}>
          {isFetching ? "Checking…" : ok ? "All passing" : "Violations found"}
        </span>
      </div>
      <ul className="space-y-1 text-xs">
        {data.map((c) => (
          <li key={c.name} className="flex gap-2">
            <span className={c.ok ? "text-yes" : "text-no"}>{c.ok ? "✓" : "✗"}</span>
            <span className="text-body">{c.name}</span>
            {!c.ok && <span className="text-no">{c.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
