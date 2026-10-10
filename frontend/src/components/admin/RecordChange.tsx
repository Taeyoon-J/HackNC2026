import type { Verification } from "../../api/types";

/** Before/after view of a profile edit (introduction, activities, applications). */
export function RecordChange({ request }: { request: Verification }) {
  const { data, previous } = request.payload;
  if (request.type === "BIOGRAPHY") {
    return (
      <div className="space-y-3">
        {(["introduction", "pitch"] as const).map((k) =>
          data[k] === previous?.[k] ? null : (
            <div key={k} className="grid gap-2 sm:grid-cols-2">
              <Box label={`Current ${k === "pitch" ? "personal statement" : k}`} muted>{previous?.[k] || "—"}</Box>
              <Box label="Proposed">{data[k] || "—"}</Box>
            </div>
          ),
        )}
      </div>
    );
  }
  const fmt = (i: any) => (typeof i === "string" ? i : `${i.name}${i.result ? ` — ${i.result}` : ""}`);
  const before: string[] = (previous?.items ?? []).map(fmt);
  const after: string[] = (data.items ?? []).map(fmt);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Box label="Current" muted>
        <List items={before} other={after} tone="text-no line-through" />
      </Box>
      <Box label="Proposed">
        <List items={after} other={before} tone="font-semibold text-yes" />
      </Box>
    </div>
  );
}

function List({ items, other, tone }: { items: string[]; other: string[]; tone: string }) {
  if (items.length === 0) return <span>—</span>;
  return (
    <ul className="list-inside list-disc space-y-1">
      {items.map((i) => (
        <li key={i} className={other.includes(i) ? "" : tone}>
          {i}
        </li>
      ))}
    </ul>
  );
}

function Box({ label, muted, children }: { label: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl p-3 text-sm ${muted ? "bg-sunken text-muted" : "bg-brand-soft text-body"}`}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="whitespace-pre-wrap">{children}</div>
    </div>
  );
}
