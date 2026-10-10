import type { Disclosure } from "../../api/types";
import { dateShort } from "../../lib/format";
import { GpaHistoryChart } from "./GpaHistoryChart";

export function DisclosureList({ disclosures, threshold }: { disclosures: Disclosure[]; threshold?: number }) {
  return (
    <div className="space-y-4">
      {disclosures.filter((d) => d.type !== "BIOGRAPHY").map((d) => (
        <section key={d.id}>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink">{d.title}</h3>
            {d.verified_at && (
              <span className="shrink-0 whitespace-nowrap text-[10px] text-yes">✓ Verified {dateShort(d.verified_at)}</span>
            )}
            {!d.verified_at && d.type === "COURSE_PROGRESS" && <span className="text-[10px] text-gold">Student reported</span>}
            {!d.verified_at && d.type !== "COURSE_PROGRESS" && <span className="text-[10px] text-gold">Pending verification</span>}
          </div>
          <DisclosureBody d={d} threshold={threshold} />
        </section>
      ))}
    </div>
  );
}

function DisclosureBody({ d, threshold }: { d: Disclosure; threshold?: number }) {
  switch (d.type) {
    case "GPA_HISTORY":
      return <div className="space-y-3">
        {d.data.terms.length > 0 ? <GpaHistoryChart terms={d.data.terms} threshold={threshold} />
          : <p className="text-xs text-muted">No completed semesters yet.</p>}
        {d.data.terms.map((term: any) => <details key={term.term} className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-xs font-semibold text-ink">{term.term} · GPA {Number(term.gpa).toFixed(2)} · {term.credits} credits</summary>
          {term.courses?.length ? <div className="mt-2 overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="text-left text-muted"><th className="py-1">Course</th><th>Credits</th><th>GPA</th></tr></thead>
            <tbody>{term.courses.map((c: any) => <tr key={c.code} className="border-t border-line">
              <td className="py-2"><span className="font-mono text-muted">{c.code}</span> {c.name}</td><td>{c.credits}</td><td>{Number(c.gpa).toFixed(2)}</td>
            </tr>)}</tbody>
          </table></div> : <p className="mt-2 text-xs text-muted">Course breakdown not provided.</p>}
        </details>)}
      </div>;
    case "COURSE_LOAD": {
      const courses = d.data.courses as { code: string; name: string; credits: number; gpa?: number }[];
      const total = courses.reduce((s, c) => s + c.credits, 0);
      return (
        <ul className="divide-y divide-line text-xs">
          {courses.map((c) => (
            <li key={c.code} className="flex justify-between py-1.5">
              <span>
                <span className="font-mono text-muted">{c.code}</span> {c.name}
              </span>
              <span className="text-muted">{c.credits} cr{c.gpa !== undefined && ` · Grade ${c.gpa.toFixed(2)}`}</span>
            </li>
          ))}
          <li className="flex justify-between py-1.5 font-medium">
            <span>Total</span>
            <span>{total} credits</span>
          </li>
        </ul>
      );
    }
    case "COURSE_PROGRESS":
      return <div className="space-y-3">
        <p className="text-xs text-muted">{d.data.term} · self-reported results for the current semester</p>
        {d.data.courses.map((course: any) => <div key={course.code} className="rounded-lg border border-line p-3">
          <h4 className="text-xs font-semibold text-ink"><span className="font-mono text-muted">{course.code}</span></h4>
          {course.assessments.length ? <ul className="mt-2 divide-y divide-line text-xs">{course.assessments.map((a: any, i: number) => <li key={`${a.title}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span className="text-body">{a.title} <span className="text-muted">· {a.category}{a.date ? ` · ${a.date}` : ""}</span></span>
            <span className="num font-semibold text-ink">{a.earned}/{a.possible} ({Math.round(a.earned / a.possible * 100)}%)</span>
          </li>)}</ul> : <p className="mt-2 text-xs text-muted">No assessment results posted yet.</p>}
        </div>)}
      </div>;
    case "ACTIVITY":
      return (
        <ul className="list-inside list-disc space-y-1 text-xs text-body">
          {(d.data.items as string[]).map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      );
    case "APPLICATION":
      return (
        <ul className="space-y-1 text-xs">
          {(d.data.items as { name: string; result: string }[]).map((i) => (
            <li key={i.name} className="flex justify-between">
              <span className="text-body">{i.name}</span>
              <span className="text-muted">{i.result}</span>
            </li>
          ))}
        </ul>
      );
  }
}
