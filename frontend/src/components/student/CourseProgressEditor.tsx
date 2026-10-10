import { useEffect, useState } from "react";
import type { CourseRecord, Disclosure } from "../../api/types";
import { api } from "../../api/client";
import { useAction } from "../../hooks/queries";

type Assessment = { title: string; category: string; earned: number; possible: number; date: string };
type Progress = { term: string; courses: { code: string; assessments: Assessment[] }[] };

export function CourseProgressEditor({ courses, disclosure }: { courses: CourseRecord[]; disclosure?: Disclosure }) {
  const [progress, setProgress] = useState<Progress>({ term: "", courses: [] });
  const save = useAction(api.me.saveCourseProgress);
  useEffect(() => {
    const saved = disclosure?.data;
    setProgress({ term: saved?.term ?? "", courses: courses.map((course) => ({
      code: course.code,
      assessments: saved?.courses?.find((c: any) => c.code === course.code)?.assessments ?? [],
    })) });
  }, [disclosure?.id, courses]);

  const update = (code: string, index: number, patch: Partial<Assessment>) => setProgress((old) => ({
    ...old, courses: old.courses.map((c) => c.code === code ? { ...c, assessments: c.assessments.map((a, i) => i === index ? { ...a, ...patch } : a) } : c),
  }));
  const add = (code: string) => setProgress((old) => ({ ...old, courses: old.courses.map((c) => c.code === code ? {
    ...c, assessments: [...c.assessments, { title: "", category: "Exam", earned: 0, possible: 100, date: "" }],
  } : c) }));
  const remove = (code: string, index: number) => setProgress((old) => ({ ...old,
    courses: old.courses.map((c) => c.code === code ? { ...c, assessments: c.assessments.filter((_, i) => i !== index) } : c),
  }));

  return <section className="card p-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="font-semibold text-ink">Current semester progress</h3>
        <p className="mt-1 text-xs text-muted">Add exam and assignment results under each verified course. Traders and admins can see updates immediately.</p></div>
      <span className="rounded-full bg-gold-soft px-2.5 py-1 text-[10px] font-semibold text-gold">Student reported</span>
    </div>
    <div className="mt-4 space-y-4">
      {courses.map((course) => <div key={course.code} className="rounded-xl border border-line p-3">
        <div className="mb-3 flex items-center justify-between"><div className="text-sm font-medium text-ink"><span className="font-mono text-muted">{course.code}</span> {course.name}</div>
          <button type="button" onClick={() => add(course.code)} className="text-xs font-semibold text-brand">+ Add result</button></div>
        {progress.courses.find((c) => c.code === course.code)?.assessments.map((assessment, index) => <div key={`${course.code}-${index}`} className="mb-2 grid gap-2 sm:grid-cols-[1.1fr_.8fr_.6fr_.6fr_.8fr_auto]">
          <input className="field text-xs" placeholder="Midterm 1 / Homework 2" value={assessment.title} onChange={(e) => update(course.code, index, { title: e.target.value })} />
          <select className="field text-xs" value={assessment.category} onChange={(e) => update(course.code, index, { category: e.target.value })}><option>Exam</option><option>Quiz</option><option>Assignment</option><option>Project</option><option>Other</option></select>
          <input className="field text-xs" aria-label="Points earned" type="number" min="0" step="0.1" placeholder="Earned" value={assessment.earned} onChange={(e) => update(course.code, index, { earned: Number(e.target.value) })} />
          <input className="field text-xs" aria-label="Points possible" type="number" min="0.1" step="0.1" placeholder="Possible" value={assessment.possible} onChange={(e) => update(course.code, index, { possible: Number(e.target.value) })} />
          <input className="field text-xs" aria-label="Assessment date" type="date" value={assessment.date} onChange={(e) => update(course.code, index, { date: e.target.value })} />
          <button type="button" onClick={() => remove(course.code, index)} className="text-xs text-no">Remove</button>
        </div>)}
        {!(progress.courses.find((c) => c.code === course.code)?.assessments.length) && <p className="text-xs text-muted">No results added.</p>}
      </div>)}
    </div>
    {save.error && <p className="mt-3 text-xs text-no">{save.error.message}</p>}
    {save.isSuccess && <p className="mt-3 text-xs text-yes">Progress saved and visible to traders.</p>}
    <div className="mt-4 flex justify-end"><button type="button" className="btn bg-brand text-white hover:bg-brand-strong" disabled={save.isPending || courses.length === 0}
      onClick={() => save.mutate({ courses: progress.courses.map((c) => ({ ...c, assessments: c.assessments.filter((a) => a.title.trim() && a.possible > 0) })) })}>
      {save.isPending ? "Saving…" : "Save progress"}</button></div>
  </section>;
}
