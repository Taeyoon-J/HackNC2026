import type { Disclosure } from "../../api/types";
import { dateShort } from "../../lib/format";
import { GpaHistoryChart } from "./GpaHistoryChart";

export function DisclosureList({ disclosures, threshold }: { disclosures: Disclosure[]; threshold?: number }) {
  return (
    <div className="space-y-4">
      {disclosures.map((d) => (
        <section key={d.id}>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink">{d.title}</h3>
            {d.verified_at && (
              <span className="shrink-0 whitespace-nowrap text-[10px] text-yes">✓ Verified {dateShort(d.verified_at)}</span>
            )}
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
      return <GpaHistoryChart terms={d.data.terms} threshold={threshold} />;
    case "COURSE_LOAD": {
      const courses = d.data.courses as { code: string; name: string; credits: number }[];
      const total = courses.reduce((s, c) => s + c.credits, 0);
      return (
        <ul className="divide-y divide-line text-xs">
          {courses.map((c) => (
            <li key={c.code} className="flex justify-between py-1.5">
              <span>
                <span className="font-mono text-muted">{c.code}</span> {c.name}
              </span>
              <span className="text-muted">{c.credits} cr</span>
            </li>
          ))}
          <li className="flex justify-between py-1.5 font-medium">
            <span>Total</span>
            <span>{total} credits</span>
          </li>
        </ul>
      );
    }
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
