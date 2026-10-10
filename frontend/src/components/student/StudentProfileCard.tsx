import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { StudentProfile, AdminStudentDetail } from "../../api/types";
import { DisclosureList } from "./DisclosureList";
import { PersonalStatement } from "./PersonalStatement";
import { StudentMarkets } from "../admin/StudentMarkets";

export function StudentProfileCard({ studentId, threshold, admin = false }: { studentId: string; threshold?: number; admin?: boolean }) {
  const { data: s, error } = useQuery<StudentProfile | AdminStudentDetail>({
    queryKey: [admin ? "admin-student" : "student", studentId],
    queryFn: () => admin ? api.admin.student(studentId) : api.student(studentId),
  });
  if (error) return <p className="text-sm text-no">{error.message}</p>;
  if (!s) return <div className="card h-64 animate-pulse" />;
  return (
    <div className="card p-5">
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft px-1 text-center font-display text-xs font-semibold leading-tight text-brand" style={{ flex: "0 0 2.75rem", maxWidth: "2.75rem", whiteSpace: "nowrap" }} aria-hidden="true">
          {s.name.replace("Student ", "").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2 font-semibold text-ink">
            <span title={s.name} className="max-w-full truncate">{s.name}</span>
            {s.verified && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand">ID verified</span>}
          </div>
          <div className="text-xs text-muted">
            {s.university} · {s.year} · {s.major}
          </div>
        </div>
      </div>
      <div className="mb-4 rounded-xl bg-sunken p-3 text-sm"><span className="text-muted">Cumulative GPA</span><strong className="num ml-3 text-ink">{s.cumulative_gpa != null ? s.cumulative_gpa.toFixed(2) : "None"}</strong></div>
      <PersonalStatement student={s} />
      <div className="card-title mb-3">Disclosures</div>
      <DisclosureList disclosures={s.disclosures} threshold={threshold} />
      {admin && "market_details" in s && <StudentMarkets student={s} />}
      <p className="mt-4 text-[10px] text-faint">{admin ? "Admin view includes records awaiting verification. " : "Academic records require verification. "}Personal statements are self-reported. All demo data is synthetic.</p>
    </div>
  );
}
