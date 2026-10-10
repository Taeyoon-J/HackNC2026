import { useStudent } from "../../hooks/queries";
import { DisclosureList } from "./DisclosureList";

export function StudentProfileCard({ studentId, threshold }: { studentId: string; threshold?: number }) {
  const { data: s } = useStudent(studentId);
  if (!s) return <div className="card h-64 animate-pulse" />;
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft font-display text-lg font-semibold text-brand">
          {s.name.replace("Student ", "")}
        </div>
        <div>
          <div className="flex items-center gap-2 font-semibold text-ink">
            {s.name}
            {s.verified && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand">Anonymous · ID verified</span>}
          </div>
          <div className="text-xs text-muted">
            {s.university} · {s.year} · {s.major}
          </div>
        </div>
      </div>
      <div className="card-title mb-3">Disclosures</div>
      <DisclosureList disclosures={s.disclosures} threshold={threshold} />
      <p className="mt-4 text-[10px] text-faint">Identity is withheld; only consented, verified records are shown. Demo data is synthetic.</p>
    </div>
  );
}
