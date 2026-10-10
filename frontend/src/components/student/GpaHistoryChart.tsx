import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";

interface Term { term: string; gpa: number; credits: number }

export function GpaHistoryChart({ terms, threshold }: { terms: Term[]; threshold?: number }) {
  const { data: averages = [] } = useQuery({ queryKey: ["gpa-averages"], queryFn: api.gpaAverages });
  const mean = new Map(averages.map((t) => [t.term, t]));
  const x = (i: number) => terms.length > 1 ? 45 + i * 545 / (terms.length - 1) : 320;
  const y = (gpa: number) => 175 - Math.max(0, Math.min(4, gpa)) * 37.5;
  const line = terms.map((t, i) => `${x(i)},${y(t.gpa)}`).join(" ");
  const comparison = terms.map((t, i) => mean.has(t.term) ? `${x(i)},${y(mean.get(t.term)!.gpa)}` : "").filter(Boolean).join(" ");
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-4 text-[11px] text-muted"><span className="text-brand">━ Student GPA</span><span className="text-gold">┄ All-student average per semester</span></div>
    <svg viewBox="0 0 640 215" className="w-full" role="img" aria-label="Semester GPA compared with the average of all students with verified grades">
      {[0, 1, 2, 3, 4].map((g) => <g key={g}><line x1={40} x2={600} y1={y(g)} y2={y(g)} stroke="#e8e1d6" /><text x={27} y={y(g) + 4} fontSize={11} fill="#6b7280">{g}</text></g>)}
      {threshold !== undefined && <line x1={40} x2={600} y1={y(threshold)} y2={y(threshold)} stroke="#9ca3af" strokeDasharray="3 5" />}
      <polyline points={comparison} fill="none" stroke="#b7791f" strokeWidth={2} strokeDasharray="7 5" />
      <polyline points={line} fill="none" stroke="#2f6f73" strokeWidth={2.5} />
      {terms.map((t, i) => <g key={t.term}>
        <circle cx={x(i)} cy={y(t.gpa)} r={4} fill="#2f6f73"><title>{t.term}: student {t.gpa.toFixed(2)}; all-student mean {mean.get(t.term)?.gpa.toFixed(2) ?? "unavailable"}</title></circle>
        {mean.has(t.term) && <circle cx={x(i)} cy={y(mean.get(t.term)!.gpa)} r={3} fill="#b7791f" />}
        <text x={x(i)} y={y(t.gpa) - 9} textAnchor="middle" fontSize={11} fill="#2f6f73">{t.gpa.toFixed(2)}</text>
        <text x={x(i)} y={199} textAnchor="middle" fontSize={9} fill="#6b7280">{t.term}</text>
      </g>)}
    </svg>
    <p className="text-[10px] text-muted">The dotted line is the unweighted mean of verified student semester GPAs. Hover over a point to compare.</p>
  </div>;
}
