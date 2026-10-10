import { Link } from "react-router-dom";
import { useState } from "react";
import { api } from "../../api/client";
import type { AdminStudent } from "../../api/types";
import { MarketStatusBadge } from "../../components/market/MarketStatusBadge";
import { useAction } from "../../hooks/queries";
import { DirectoryPagination, DirectorySearch, useDirectory } from "../../components/student/DirectorySearch";
import { StudentProfileCard } from "../../components/student/StudentProfileCard";

export function AdminStudents() {
  const directory = useDirectory("admin-students-directory", api.admin.searchStudents);
  const students = directory.data?.items ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const verify = useAction(api.admin.verifyStudent);
  const delist = useAction(api.admin.delistStudent);
  const restore = useAction(api.admin.restoreStudent);
  const error = verify.error ?? delist.error ?? restore.error ?? directory.error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Students</h1>
          <p className="text-sm text-muted">Verify records and control who is listed to traders.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Count label="Total" value={directory.data?.total_all ?? 0} />
          <Count label="Needs review" value={directory.data?.summary.needs_review ?? 0} tone="text-gold" />
          <Count label="Delisted" value={directory.data?.summary.delisted ?? 0} tone="text-no" />
        </div>
      </div>
      {error && <p className="rounded-xl bg-no-soft px-4 py-2 text-sm text-no">{error.message}</p>}

      <DirectorySearch directory={directory} states={[{ value: "REVIEW", label: "Needs review" }, { value: "ACTIVE", label: "Listed" }, { value: "DELISTED", label: "Delisted" }]} />
      {selected && <section className="space-y-2">
        <div className="flex justify-between"><h2 className="font-semibold text-ink">Student profile & records</h2>
          <button type="button" className="text-sm text-brand" onClick={() => setSelected(null)}>Close profile</button></div>
        <StudentProfileCard key={selected} studentId={selected} admin />
      </section>}
      {directory.isLoading && <p className="text-sm text-muted">Loading students…</p>}
      {!directory.isLoading && students.length === 0 && <p className="text-sm text-muted">No students match your search.</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-5 py-3 font-semibold">Student</th>
              <th className="px-3 py-3 font-semibold">Profile</th>
              <th className="px-3 py-3 font-semibold">Verification</th>
              <th className="px-3 py-3 font-semibold">Goals</th>
              <th className="px-3 py-3 font-semibold">Listing</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <Row
                key={s.id}
                s={s}
                onView={() => setSelected(s.id)}
                busy={verify.isPending || delist.isPending || restore.isPending}
                onVerify={() => verify.mutate(s.id)}
                onDelist={() => confirm(`Remove ${s.name} from the trader listing? Open orders will be cancelled.`) && delist.mutate(s.id)}
                onRestore={() => restore.mutate(s.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <DirectoryPagination directory={directory} />
    </div>
  );
}

function Row({ s, busy, onView, onVerify, onDelist, onRestore }: {
  s: AdminStudent; busy: boolean; onView: () => void; onVerify: () => void; onDelist: () => void; onRestore: () => void;
}) {
  const needsReview = !s.verified || s.pending_disclosures > 0;
  const delisted = s.status === "DELISTED";
  return (
    <tr className={`border-b border-line last:border-0 ${delisted ? "bg-sunken/60 text-muted" : ""}`}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-display font-semibold text-brand">
            {s.name.replace("Student ", "").slice(0, 2).toUpperCase()}
          </span>
          <div>
            <button type="button" className="font-semibold text-brand hover:underline" onClick={onView}>{s.name}</button>
            <div className="font-mono text-[11px] text-muted">{s.id}</div>
          </div>
        </div>
        {s.introduction && <p className="mt-2 max-w-xs line-clamp-2 text-xs text-muted">{s.introduction}</p>}
      </td>
      <td className="px-3 py-3 text-xs">
        <div className="text-body">{s.university}</div>
        <div className="text-muted">
          {s.year} · {s.major}
        </div>
      </td>
      <td className="px-3 py-3">
        {needsReview ? (
          <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold">
            {s.verified ? `${s.pending_disclosures} update(s) pending` : "Unverified"}
          </span>
        ) : (
          <span className="rounded-full bg-yes-soft px-2 py-0.5 text-xs font-semibold text-yes">✓ Verified</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1">
          {s.markets.length === 0 && <span className="text-xs text-faint">None</span>}
          {s.markets.map((m) => (
            <Link key={m.id} to={`/admin?market=${m.id}`} className="flex items-center gap-2 text-xs hover:underline">
              <span>
                {m.term} · ≥ {m.threshold}
              </span>
              <MarketStatusBadge status={m.status} />
            </Link>
          ))}
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`text-xs font-semibold ${s.status === "PENDING_VERIFICATION" ? "text-gold" : delisted ? "text-no" : "text-yes"}`}>{s.status === "PENDING_VERIFICATION" ? "Requires verification" : delisted ? "Delisted" : "Listed"}</span>
      </td>
      <td className="px-5 py-3">
        <div className="flex justify-end gap-2">
          {needsReview && (
            <button type="button" disabled={busy} onClick={onVerify} className="btn bg-brand text-white hover:bg-brand-strong">
              Verify
            </button>
          )}
          {delisted ? (
            <button type="button" disabled={busy} onClick={onRestore} className="btn border border-line bg-surface text-ink hover:bg-sunken">
              Restore
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={onDelist} className="btn border border-no/30 bg-surface text-no hover:bg-no-soft">
              Remove from list
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function Count({ label, value, tone = "text-ink" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card px-4 py-2 text-center">
      <div className={`num font-display text-xl font-semibold ${tone}`}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
