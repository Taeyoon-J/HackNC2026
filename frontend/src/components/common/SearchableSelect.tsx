import { useEffect, useMemo, useRef, useState } from "react";

export function SearchableSelect({ label, value, options, onChange, placeholder, disabled = false }: {
  label: string; value: string; options: readonly string[]; onChange: (value: string) => void; placeholder: string; disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => setQuery(value), [value]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const matches = useMemo(() => options.filter((item) => item.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12), [options, query]);
  return <div ref={root} className="relative min-w-0">
    <label className="block text-xs text-muted">{label}<input className="input mt-1" role="combobox" aria-expanded={open} aria-autocomplete="list"
      value={query} disabled={disabled} placeholder={placeholder} autoComplete="off"
      onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter" && open && matches[0]) { e.preventDefault(); onChange(matches[0]); setQuery(matches[0]); setOpen(false); } }} />
    </label>
    {open && !disabled && <div role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
      {matches.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-body hover:bg-brand-soft hover:text-brand"
        onPointerDown={(e) => e.preventDefault()} onClick={() => { onChange(option); setQuery(option); setOpen(false); }}>{option}</button>)}
      {matches.length === 0 && <p className="p-3 text-xs text-muted">No matches in the list.</p>}
    </div>}
  </div>;
}
