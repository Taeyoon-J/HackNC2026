import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { EvidenceFile } from "../../api/types";
import { StudentProfileCard } from "../../components/student/StudentProfileCard";
import { ScholarshipSummary } from "../../components/admin/ScholarshipSummary";
import { useAction, useMarket } from "../../hooks/queries";
import { VERIFICATION_LABELS, summarize } from "../../lib/verification";
import { RecordChange } from "../../components/admin/RecordChange";

function Evidence({ file }: { file: EvidenceFile }) {
  const bytes = useMemo(() => Uint8Array.from(atob(file.data_base64), (c) => c.charCodeAt(0)), [file.data_base64]);
  const url = useMemo(() => URL.createObjectURL(new Blob([bytes], { type: file.content_type })), [bytes, file.content_type]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <div className="space-y-2"><a className="text-sm font-semibold text-brand hover:underline" href={url} download={file.name}>Download {file.name}</a>
    {file.content_type.startsWith("image/") && <img src={url} alt="Student supporting evidence" className="max-h-96 rounded-xl border border-line" />}
    {file.content_type === "text/plain" && <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-sunken p-3 text-xs text-body">{new TextDecoder().decode(bytes)}</pre>}
    {file.content_type === "application/pdf" && <iframe title="Supporting PDF evidence" src={url} className="h-96 w-full rounded-xl border border-line" />}
  </div>;
}

export function AdminVerification() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ q: "", type: "", status: "PENDING", page: 1 });
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => { const timer = setTimeout(() => setFilters((f) => ({ ...f, q: query, page: 1 })), 250); return () => clearTimeout(timer); }, [query]);
  const { data, error, isFetching } = useQuery({ queryKey: ["admin-verifications", filters], queryFn: () => api.admin.verifications(filters), placeholderData: keepPreviousData });
  const { data: request, error: detailError } = useQuery({ queryKey: ["verification", selected], queryFn: () => api.admin.verification(selected!), enabled: selected !== null });
  const { data: market } = useMarket(request?.payload.market_id ?? "");
  const approve = useAction(api.admin.approveVerification);
  const reject = useAction(api.admin.rejectVerification);
  const actionError = approve.error ?? reject.error;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  return <div className="space-y-4">
    <div><h1 className="font-display text-2xl font-semibold text-ink">Verification</h1><p className="text-sm text-muted">Review oldest requests first. Academic changes apply only after approval.</p></div>
    <div className="card grid gap-3 p-4 sm:grid-cols-[2fr_1fr_1fr]">
      <label className="text-xs text-muted">Search requests<input type="search" className="input mt-1" value={query} placeholder="Student, university, major, requested change or evidence" onChange={(e) => setQuery(e.target.value)} /></label>
      <label className="text-xs text-muted">Request type<select className="input mt-1" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}><option value="">All types</option>{Object.entries(VERIFICATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-xs text-muted">Status<select className="input mt-1" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label>
    </div>
    {(error ?? detailError) && <p className="text-sm text-no">{(error ?? detailError)?.message}</p>}
    <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
      <section className="card space-y-2 p-3"><p className="px-2 text-xs text-muted">{isFetching ? "Loading…" : `${data?.total ?? 0} requests · oldest first`}</p>
        {data?.items.map((r) => <button key={r.id} type="button" onClick={() => { setSelected(r.id); setNote(""); approve.reset(); reject.reset(); }} className={`w-full rounded-xl border p-3 text-left ${selected === r.id ? "border-brand bg-brand-soft" : "border-line hover:bg-sunken"}`}>
          <span className="flex justify-between gap-2 text-sm"><strong>{r.student.name}</strong><span className="text-xs text-gold">{r.status.toLowerCase()}</span></span>
          <span className="mt-1 block text-xs font-semibold text-brand">{VERIFICATION_LABELS[r.type]}</span>
          <span className="mt-1 block text-xs text-muted">{summarize(r)}</span>
          <span className="mt-1 block text-[10px] text-muted">{new Date(r.created_at).toLocaleString()} · {r.student.id}</span>
        </button>)}
        {data?.items.length === 0 && <p className="p-4 text-sm text-muted">No requests match these filters.</p>}
        <div className="flex items-center justify-between pt-2 text-xs text-muted"><button type="button" className="btn" disabled={filters.page === 1 || isFetching} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>Previous</button><span>{filters.page} / {pages}</span><button type="button" className="btn" disabled={filters.page >= pages || isFetching} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Next</button></div>
      </section>
      {request ? <div className="space-y-4">
        <section className="card space-y-4 p-5"><h2 className="font-semibold text-ink">{VERIFICATION_LABELS[request.type]} · {request.student.name}</h2>
          <p className="text-xs text-muted">Requested {new Date(request.created_at).toLocaleString()} · {request.status.toLowerCase()}</p>
          {request.payload.data && <RecordChange request={request} />}
          {request.type === "REGISTRATION" && <div className="space-y-3 text-sm text-body">
            <p>{request.payload.university} · {request.payload.year} · {request.payload.major}</p>
            <p className="rounded-xl bg-brand-soft p-3">Approval activates this account and assigns a random GPA goal and initial achievement probability for the demo.</p>
            {[...(request.payload.academic_history?.terms ?? []), ...(request.payload.current_course_load ? [request.payload.current_course_load] : [])].map((term) => <div key={term.term}>
              <h3 className="font-semibold">{term.term}</h3>
              {term.courses.map((c) => <p key={c.code}>{c.code} · {c.name} · {c.credits} credits{c.gpa !== undefined ? ` · GPA ${c.gpa.toFixed(2)}` : ""}</p>)}
            </div>)}
            {request.payload.academic_history?.terms.length === 0 && <p>No completed semesters declared (freshman).</p>}
          </div>}
          {request.payload.value && <p className="rounded-xl bg-brand-soft p-3 text-sm text-body">{request.payload.previous} → <strong>{request.payload.value}</strong></p>}
          {request.payload.courses && <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted"><th className="py-2">Course</th><th>Credits</th><th>Grade</th></tr></thead><tbody>{request.payload.courses.map((c) => <tr key={c.code} className="border-t border-line"><td className="py-2">{c.code} · {c.name}</td><td>{c.credits}</td><td>{c.gpa?.toFixed(2) ?? "—"}</td></tr>)}</tbody></table></div>}
          {request.type === "FINAL_GPA" && <p className="rounded-xl bg-gold-soft p-3 text-sm text-gold">Final GPA {request.payload.gpa?.toFixed(2)} for {request.payload.term}.{market && ` Target GPA ≥ ${market.threshold.toFixed(2)}: ${(request.payload.gpa ?? 0) >= market.threshold ? "goal achieved" : "goal missed"}.`} Approval immediately closes trading, cancels pending orders and pays YES shares and the adjusted scholarship.</p>}
          {request.type === "FINAL_GPA" && market && <ScholarshipSummary market={market} />}
          <div><h3 className="mb-1 text-sm font-semibold text-ink">Supporting evidence</h3><p className="whitespace-pre-wrap text-sm text-body">{request.evidence || (request.evidence_file ? "" : "No evidence attached.")}</p></div>
          {request.evidence_file && <Evidence file={request.evidence_file} />}
          {request.status === "PENDING" ? <>
            <label className="block text-xs text-muted">Review note (required for rejection)<textarea className="input mt-1" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <div className="flex gap-2"><button type="button" className="btn bg-brand text-white" disabled={approve.isPending || reject.isPending} onClick={() => approve.mutate({ id: request.id, note })}>Approve & apply{request.type === "FINAL_GPA" ? " / settle" : ""}</button>
              <button type="button" className="btn border border-no/30 text-no" disabled={approve.isPending || reject.isPending || !note.trim()} onClick={() => reject.mutate({ id: request.id, note })}>Reject</button></div>
          </> : <p className="text-sm text-muted">Reviewed {request.reviewed_at && new Date(request.reviewed_at).toLocaleString()} · {request.review_note}</p>}
          {actionError && <p className="text-sm text-no">{actionError.message}</p>}
        </section>
        <StudentProfileCard key={request.student.id} studentId={request.student.id} admin />
      </div> : <div className="card p-10 text-center text-sm text-muted">Select a request to inspect the student profile and evidence.</div>}
    </div>
  </div>;
}
