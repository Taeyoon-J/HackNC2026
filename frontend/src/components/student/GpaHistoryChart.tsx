interface Term {
  term: string;
  gpa: number;
  credits: number;
}

/** Simple bar chart of term GPAs with the market threshold drawn as a line. */
export function GpaHistoryChart({ terms, threshold }: { terms: Term[]; threshold?: number }) {
  const min = 0.0;
  const max = 4.0;
  const h = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%`;
  return (
    <>
    {threshold != null && (
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gold">
        <span className="w-4 border-t border-dashed border-gold" /> Target {threshold}
      </div>
    )}
    <div className="relative mt-2 h-40">
      {threshold != null && (
        <div className="absolute inset-x-0 z-10 border-t border-dashed border-gold/70" style={{ bottom: h(threshold) }} />
      )}
      <div className="flex h-full items-end gap-2">
        {terms.map((t) => (
          <div key={t.term} className="flex h-full flex-1 flex-col justify-end">
            <div className="num relative z-20 mx-auto mb-1 rounded bg-surface px-1 text-center text-[11px] text-body">{t.gpa.toFixed(2)}</div>
            <div
              className={`rounded-t ${threshold != null && t.gpa >= threshold ? "bg-yes/70" : "bg-brand/50"}`}
              style={{ height: h(t.gpa) }}
            />
            <div className="mt-1 truncate text-center text-[10px] text-muted">{t.term}</div>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
