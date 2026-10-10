import type { CourseRecord } from "../../api/types";

export const newCourse = (graded = false): CourseRecord => ({ code: "", name: "", credits: 3, ...(graded ? { gpa: 0 } : {}) });
export interface SemesterInput { term: string; courses: CourseRecord[] }

export function SemesterFields({ value, onChange, graded = false }: { value: SemesterInput; onChange: (v: SemesterInput) => void; graded?: boolean }) {
  return <div className="space-y-2 rounded-xl border border-line p-3">
    <label className="block text-xs text-muted">Semester (e.g. Fall 2026)<input required className="input mt-1" value={value.term} placeholder="Fall 2026" onChange={(e) => onChange({ ...value, term: e.target.value })} /></label>
    {value.courses.map((course, index) => {
      const update = (patch: Partial<CourseRecord>) => onChange({ ...value, courses: value.courses.map((c, i) => i === index ? { ...c, ...patch } : c) });
      return <div key={index} className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">Course code<input required className="input mt-1" placeholder="COMP 110" maxLength={40} value={course.code} onChange={(e) => update({ code: e.target.value })} /></label>
        <label className="text-xs text-muted">Course name<input required className="input mt-1" maxLength={200} value={course.name} onChange={(e) => update({ name: e.target.value })} /></label>
        <label className="text-xs text-muted">Credits<input required type="number" min={0.1} max={12} step={0.1} className="input mt-1" value={course.credits} onChange={(e) => update({ credits: Number(e.target.value) })} /></label>
        {graded && <label className="text-xs text-muted">Grade GPA (0–4)<input required type="number" min={0} max={4} step={0.01} className="input mt-1" value={course.gpa} onChange={(e) => update({ gpa: Number(e.target.value) })} /></label>}
        {value.courses.length > 1 && <button type="button" className="text-left text-xs text-no" onClick={() => onChange({ ...value, courses: value.courses.filter((_, i) => i !== index) })}>Remove course</button>}
      </div>;
    })}
    <button type="button" className="text-xs font-semibold text-brand" disabled={value.courses.length >= 30} onClick={() => onChange({ ...value, courses: [...value.courses, newCourse(graded)] })}>+ Add course</button>
  </div>;
}
