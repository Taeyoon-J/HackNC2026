import type { StudentBrief } from "../../api/types";

export function PersonalStatement({ student }: { student: StudentBrief }) {
  return <section className="mb-5 space-y-3 rounded-xl bg-brand-soft/40 p-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-semibold text-ink">About me</h3>
      <span className="text-[10px] text-muted">Self-reported</span>
    </div>
    <p className="whitespace-pre-wrap break-words text-sm text-body">{student.introduction || "No introduction added yet."}</p>
    <h3 className="text-sm font-semibold text-ink">Why back me?</h3>
    <p className="whitespace-pre-wrap break-words text-sm text-body">{student.pitch || "No personal statement added yet."}</p>
  </section>;
}
