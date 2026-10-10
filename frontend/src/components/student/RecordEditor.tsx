import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Disclosure, DisclosureType, Verification } from "../../api/types";
import { useAction } from "../../hooks/queries";
import { dateShort } from "../../lib/format";
import { TranscriptEditor } from "./TranscriptEditor";

type Row = Record<string, string>;

interface Column {
  key: string;
  label: string;
  numeric?: boolean;
  placeholder?: string;
  className?: string;
}

interface Spec {
  title: string;
  hint: string;
  columns: Column[];
  toRows: (data: any) => Row[];
  fromRows: (rows: Row[]) => unknown;
}

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

const SPECS: Record<DisclosureType, Spec> = {
  BIOGRAPHY: {
    title: "About me & personal statement", hint: "Self-reported profile text.",
    columns: [{ key: "introduction", label: "Introduction" }, { key: "pitch", label: "Personal statement" }],
    toRows: (d) => [{ introduction: d?.introduction ?? "", pitch: d?.pitch ?? "" }],
    fromRows: (rows) => rows[0] ?? { introduction: "", pitch: "" },
  },
  GPA_HISTORY: {
    title: "Term GPA",
    hint: "Upload transcripts to your advisor; an admin verifies these numbers.",
    columns: [
      { key: "term", label: "Term", placeholder: "Fall 2025" },
      { key: "gpa", label: "GPA", numeric: true, placeholder: "3.70", className: "w-24 shrink-0" },
      { key: "credits", label: "Credits", numeric: true, placeholder: "15", className: "w-24 shrink-0" },
    ],
    toRows: (d) => (d?.terms ?? []).map((t: any) => ({ term: t.term, gpa: String(t.gpa), credits: String(t.credits) })),
    fromRows: (rows) => ({ terms: rows.map((r) => ({ term: r.term, gpa: num(r.gpa), credits: num(r.credits) })) }),
  },
  COURSE_LOAD: {
    title: "Current course load",
    hint: "Courses you are taking in the goal term.",
    columns: [
      { key: "code", label: "Code", placeholder: "COMP 550", className: "w-32 shrink-0" },
      { key: "name", label: "Course", placeholder: "Algorithms" },
      { key: "credits", label: "Credits", numeric: true, placeholder: "3", className: "w-24 shrink-0" },
    ],
    toRows: (d) => (d?.courses ?? []).map((c: any) => ({ code: c.code, name: c.name, credits: String(c.credits) })),
    fromRows: (rows) => ({ courses: rows.map((r) => ({ code: r.code, name: r.name, credits: num(r.credits) })) }),
  },
  ACTIVITY: {
    title: "Activities",
    hint: "Clubs, jobs, research — anything that affects your time.",
    columns: [{ key: "text", label: "Activity", placeholder: "Undergraduate TA – COMP 210" }],
    toRows: (d) => (d?.items ?? []).map((t: string) => ({ text: t })),
    fromRows: (rows) => ({ items: rows.map((r) => r.text) }),
  },
  APPLICATION: {
    title: "Achievements & awards",
    hint: "Internships, scholarships, honors and their results.",
    columns: [
      { key: "name", label: "Program", placeholder: "Dean's List" },
      { key: "result", label: "Result", placeholder: "Awarded", className: "w-36 shrink-0" },
    ],
    toRows: (d) => (d?.items ?? []).map((i: any) => ({ name: i.name, result: i.result })),
    fromRows: (rows) => ({ items: rows.map((r) => ({ name: r.name, result: r.result })) }),
  },
};

export function RecordEditor({ type, disclosure, pending }: { type: DisclosureType; disclosure?: Disclosure; pending?: Verification }) {
  if (type === "GPA_HISTORY") return <TranscriptEditor disclosure={disclosure} />;
  return <SimpleRecordEditor type={type} disclosure={disclosure} pending={pending} />;
}

/** Edits are sent to the admin queue; until approved the editor shows the pending version. */
function SimpleRecordEditor({ type, disclosure, pending }: { type: DisclosureType; disclosure?: Disclosure; pending?: Verification }) {
  const spec = SPECS[type];
  const source = pending?.payload.data ?? disclosure?.data;
  const [rows, setRows] = useState<Row[]>(() => spec.toRows(source));
  const [dirty, setDirty] = useState(false);
  const save = useAction(api.me.saveDisclosure);

  useEffect(() => {
    if (!dirty) setRows(spec.toRows(source));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disclosure, pending?.id, pending?.created_at]);

  const edit = (next: Row[]) => {
    setRows(next);
    setDirty(true);
  };
  const blank = Object.fromEntries(spec.columns.map((c) => [c.key, ""]));
  const filled = rows.filter((r) => spec.columns.some((c) => r[c.key]?.trim()));

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{spec.title}</h3>
          <p className="text-xs text-muted">{spec.hint}</p>
        </div>
        <VerificationBadge disclosure={disclosure} dirty={dirty} pending={!!pending} />
      </div>

      <div className="mt-3 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            {spec.columns.map((c) => (
              <input
                key={c.key}
                aria-label={c.label}
                className={`input ${c.className ?? "min-w-0 flex-1"}`}
                inputMode={c.numeric ? "decimal" : undefined}
                placeholder={c.placeholder}
                value={row[c.key] ?? ""}
                onChange={(e) => edit(rows.map((r, j) => (j === i ? { ...r, [c.key]: e.target.value } : r)))}
              />
            ))}
            <button
              type="button"
              aria-label="Remove row"
              className="btn px-2 text-faint hover:bg-no-soft hover:text-no"
              onClick={() => edit(rows.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => edit([...rows, blank])}>
          + Add row
        </button>
        <button
          type="button"
          className="btn bg-brand text-white hover:bg-brand-strong"
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate({ type, data: spec.fromRows(filled) }, { onSuccess: () => setDirty(false) })
          }
        >
          {save.isPending ? "Sending…" : "Submit for review"}
        </button>
      </div>
      {save.error && <p className="mt-2 text-xs text-no">{save.error.message}</p>}
      {pending && !dirty && <p className="mt-2 text-xs text-gold">Sent to admin. The community sees the previous version until it is approved.</p>}
    </section>
  );
}

function VerificationBadge({ disclosure, dirty, pending }: { disclosure?: Disclosure; dirty: boolean; pending: boolean }) {
  if (pending && !dirty)
    return <span className="shrink-0 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-gold">Waiting for admin review</span>;
  if (dirty) return <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[11px] text-muted">Unsaved</span>;
  if (!disclosure) return <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[11px] text-muted">Not added</span>;
  if (!disclosure.verified_at)
    return (
      <span className="shrink-0 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-gold">
        Pending verification
      </span>
    );
  return (
    <span className="shrink-0 rounded-full bg-yes-soft px-2 py-0.5 text-[11px] font-semibold text-yes">
      ✓ Verified {dateShort(disclosure.verified_at)}
    </span>
  );
}
