import { useEffect, useState } from "react";
import type { Disclosure } from "../../api/types";
import { api } from "../../api/client";
import { useAction } from "../../hooks/queries";

interface Course { code: string; name: string; credits: number; gpa: number }
interface Term { term: string; gpa: number; credits: number; courses?: Course[] }
const blankCourse = (): Course => ({ code: "", name: "", credits: 3, gpa: 3.5 });
function calculate(term: Term): Term {
  if (!term.courses?.length) return term;
  const credits = term.courses.reduce((s, c) => s + c.credits, 0);
  return { ...term, credits, gpa: credits ? Math.round(100 * term.courses.reduce((s, c) => s + c.credits * c.gpa, 0) / credits) / 100 : 0 };
}

export function TranscriptEditor({ disclosure }: { disclosure?: Disclosure }) {
  const [terms, setTerms] = useState<Term[]>(disclosure?.data.terms ?? []);
  const [dirty, setDirty] = useState(false);
  const save = useAction(api.me.saveDisclosure);
  useEffect(() => { if (!dirty) setTerms(disclosure?.data.terms ?? []); }, [disclosure, dirty]);
  const edit = (next: Term[]) => { setTerms(next.map(calculate)); setDirty(true); };
  const invalid = terms.some((t) => !t.term.trim() || !Number.isFinite(t.gpa) || t.gpa < 0 || t.gpa > 4
    || t.credits <= 0 || t.courses?.some((c) => !c.code.trim() || !c.name.trim() || !Number.isFinite(c.gpa)
      || c.gpa < 0 || c.gpa > 4 || !Number.isFinite(c.credits) || c.credits <= 0 || c.credits > 12));
  return <section className="card space-y-4 p-5">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="font-semibold text-ink">Semester courses & GPA</h3>
        <p className="text-xs text-muted">Course GPA uses a 0–4 scale. Semester GPA is weighted by course credits.</p></div>
      <span className="text-xs text-muted">{dirty ? "Unsaved" : disclosure?.verified_at ? "Verified" : "Pending verification"}</span>
    </div>
    {terms.length === 0 && <p className="text-sm text-muted">No completed semesters yet. Add your first transcript when available.</p>}
    {terms.map((term, i) => <details key={i} className="rounded-xl border border-line p-3" open={dirty ? true : undefined}>
      <summary className="cursor-pointer text-sm font-semibold text-ink">{term.term || "New semester"} · GPA {term.gpa.toFixed(2)} · {term.credits} credits</summary>
      <div className="mt-3 flex gap-2">
        <input className="input" aria-label="Semester" placeholder="Fall 2025" value={term.term}
          onChange={(e) => edit(terms.map((t, j) => j === i ? { ...t, term: e.target.value } : t))} />
        <button type="button" className="btn text-no" onClick={() => edit(terms.filter((_, j) => j !== i))}>Remove semester</button>
      </div>
      {!term.courses?.length && <div className="mt-2 flex gap-2">
        <label className="text-xs text-muted">Semester GPA<input className="input" type="number" min={0} max={4} step={0.01} value={term.gpa}
          onChange={(e) => edit(terms.map((t, j) => j === i ? { ...t, gpa: Number(e.target.value) } : t))} /></label>
        <label className="text-xs text-muted">Credits<input className="input" type="number" min={1} value={term.credits}
          onChange={(e) => edit(terms.map((t, j) => j === i ? { ...t, credits: Number(e.target.value) } : t))} /></label>
      </div>}
      <div className="mt-3 space-y-2">
        {term.courses?.map((course, ci) => <div key={ci} className="grid grid-cols-2 gap-2 rounded-lg bg-sunken p-2 sm:grid-cols-[1fr_2fr_70px_70px_auto]">
          {(["code", "name", "credits", "gpa"] as const).map((key) => <label key={key} className="text-[10px] text-muted">{key === "gpa" ? "Course GPA" : key}
            <input className="input" aria-label={key === "gpa" ? "Course GPA" : key} type={key === "credits" || key === "gpa" ? "number" : "text"}
              step={key === "gpa" ? "0.01" : undefined} min={key === "gpa" ? 0 : key === "credits" ? 1 : undefined} max={key === "gpa" ? 4 : key === "credits" ? 12 : undefined}
              value={course[key]} onChange={(e) => edit(terms.map((t, j) => j !== i ? t : { ...t,
                courses: t.courses!.map((c, k) => k !== ci ? c : { ...c, [key]: key === "gpa" || key === "credits" ? Number(e.target.value) : e.target.value }) }))} /></label>)}
          <button type="button" aria-label="Remove course" className="btn text-no" onClick={() => edit(terms.map((t, j) => j !== i ? t : { ...t, courses: t.courses!.filter((_, k) => k !== ci) }))}>×</button>
        </div>)}
      </div>
      <button type="button" className="mt-2 text-sm text-brand" onClick={() => edit(terms.map((t, j) => j !== i ? t : { ...t, courses: [...(t.courses ?? []), blankCourse()] }))}>+ Add course</button>
    </details>)}
    <div className="flex items-center justify-between gap-2">
      <button type="button" className="text-sm text-brand" onClick={() => edit([...terms, { term: "", gpa: 3.5, credits: 3, courses: [blankCourse()] }])}>+ Add semester</button>
      <button type="button" className="btn bg-brand text-white" disabled={!dirty || invalid || save.isPending}
        onClick={() => save.mutate({ type: "GPA_HISTORY", data: { terms: terms.map(calculate) } }, { onSuccess: () => setDirty(false) })}>
        {save.isPending ? "Saving…" : "Save transcript"}</button>
    </div>
    {invalid && <p className="text-xs text-no">Complete course names and codes, GPA (0–4) and positive credits before saving.</p>}
    {save.error && <p className="text-xs text-no">{save.error.message}</p>}
  </section>;
}
