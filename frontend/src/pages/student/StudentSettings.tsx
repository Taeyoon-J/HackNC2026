import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { CourseRecord, EvidenceFile, VerificationInput, VerificationType } from "../../api/types";
import { useAction, useMyStudent, useMyVerifications } from "../../hooks/queries";
import { SETTINGS_TYPES, VERIFICATION_LABELS, summarize } from "../../lib/verification";
import { SearchableSelect } from "../../components/common/SearchableSelect";
import { AcademicTermSelect } from "../../components/common/AcademicTermSelect";
import { MAJORS, UNIVERSITIES } from "../../lib/academicOptions";

export { VERIFICATION_LABELS };

export function StudentSettings() {
  const { data: me } = useMyStudent();
  const { data: account } = useQuery({ queryKey: ["account"], queryFn: api.account.get });
  const { data: requests = [] } = useMyVerifications();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const accountSave = useAction(api.account.update);
  const submit = useAction(api.me.submitVerification);
  const [type, setType] = useState<VerificationType>("UNIVERSITY");
  const [value, setValue] = useState("");
  const [evidence, setEvidence] = useState("");
  const [file, setFile] = useState<EvidenceFile | null>(null);
  const [fileError, setFileError] = useState("");
  const [term, setTerm] = useState("");
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const load = me?.disclosures.find((d) => d.type === "COURSE_LOAD");
  useEffect(() => { if (account) setUsername(account.username); }, [account?.username]);
  useEffect(() => {
    setCourses((load?.data.courses ?? []).map((c: CourseRecord) => ({ ...c })));
    setTerm(load?.data.term ?? "");
  }, [me?.id, type, load?.verified_at]);
  if (!me) return <div className="card h-64 animate-pulse" />;
  const goal = me.markets.find((m) => m.status === "TRADING" || m.status === "CLOSED");
  const pending = requests.some((r) => r.type === type && r.status === "PENDING");
  const totalCredits = courses.reduce((s, c) => s + c.credits, 0);
  const finalGpa = totalCredits ? courses.reduce((s, c) => s + c.credits * (c.gpa ?? 0), 0) / totalCredits : 0;
  const invalidCourses = courses.length === 0 || courses.some((c) => !c.code.trim() || !c.name.trim() || !Number.isFinite(c.credits) || c.credits <= 0
    || (type === "FINAL_GPA" && (c.gpa === undefined || !Number.isFinite(c.gpa) || c.gpa < 0 || c.gpa > 4)));
  const send = () => {
    const input: VerificationInput = { type, evidence, evidence_file: file,
      payload: type === "UNIVERSITY" || type === "MAJOR" ? { value } : type === "FINAL_GPA" ? { market_id: goal?.id, courses } : { term, courses } };
    submit.mutate(input, { onSuccess: () => { setEvidence(""); setFile(null); setValue(""); } });
  };
  const upload = async (chosen?: File) => {
    setFile(null); setFileError("");
    if (!chosen) return;
    if (chosen.size > 3 * 1024 * 1024) { setFileError("Choose a file of at most 3 MB."); return; }
    const contentType = chosen.type || (chosen.name.endsWith(".txt") ? "text/plain" : "");
    if (!["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(contentType)) { setFileError("Use PDF, PNG, JPEG or text evidence."); return; }
    const reader = new FileReader();
    reader.onload = () => setFile({ name: chosen.name, content_type: contentType, data_base64: String(reader.result).split(",")[1] });
    reader.onerror = () => setFileError("Could not read the evidence file.");
    reader.readAsDataURL(chosen);
  };
  return <div className="space-y-6">
    <div><h1 className="font-display text-2xl font-semibold text-ink">Settings</h1><p className="text-sm text-muted">Manage your account and submit academic changes for verification.</p></div>
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">Account ID & password</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted">Account ID<input className="input mt-1" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></label>
        {account?.has_password && <label className="text-xs text-muted">Current password<input type="password" className="input mt-1" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /></label>}
        <label className="text-xs text-muted">New password (8+ characters)<input type="password" className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
      </div>
      <button type="button" className="btn bg-brand text-white" disabled={accountSave.isPending || !username || (password.length > 0 && password.length < 8)}
        onClick={() => accountSave.mutate({ username, password, current_password: currentPassword }, { onSuccess: () => { setPassword(""); setCurrentPassword(""); } })}>Save account</button>
      {accountSave.error && <p className="text-sm text-no">{accountSave.error.message}</p>}
      {accountSave.isSuccess && <p className="text-sm text-yes">Account updated.</p>}
    </section>
    <section className="card space-y-4 p-5">
      <div><h2 className="font-semibold text-ink">Request academic verification</h2><p className="text-xs text-muted">Your current profile remains unchanged until an admin approves. Past semesters and academic year cannot be edited.</p></div>
      <label className="block text-xs text-muted">Request type<select className="input mt-1" value={type} onChange={(e) => { setType(e.target.value as VerificationType); submit.reset(); setValue(""); }}>
        {SETTINGS_TYPES.map((key) => <option key={key} value={key}>{VERIFICATION_LABELS[key]}</option>)}
      </select></label>
      {type === "UNIVERSITY" || type === "MAJOR" ? <SearchableSelect label={`Proposed ${type.toLowerCase()} (currently ${type === "UNIVERSITY" ? me.university : me.major})`}
        value={value} options={type === "UNIVERSITY" ? UNIVERSITIES : MAJORS} placeholder={`Search ${type.toLowerCase()}s`}
        onChange={setValue} /> : <>
        {type === "FINAL_GPA" ? <p className="rounded-xl bg-gold-soft p-3 text-sm text-gold">{goal ? `${goal.term}: approval will close trading, finalize your transcript and pay the scholarship. Calculated GPA: ${finalGpa.toFixed(2)}` : "No active GPA goal available for final verification."}</p>
          : <AcademicTermSelect value={term} onChange={setTerm} />}
        <div className="space-y-2">{courses.map((c, i) => <div key={i} className="grid gap-2 rounded-xl bg-sunken p-3 sm:grid-cols-[1fr_2fr_80px_90px_auto]">
          {(["code", "name", "credits", "gpa"] as const).map((key) => <label key={key} className="text-[10px] text-muted">{key === "gpa" ? "Grade (0–4)" : key}
            <input className="input mt-1" type={key === "credits" ? "number" : "text"} inputMode={key === "gpa" ? "decimal" : undefined} pattern={key === "gpa" ? "(?:[0-3](?:\\.\\d*)?|4(?:\\.0*)?)" : undefined}
              min={key === "gpa" ? 0 : key === "credits" ? 1 : undefined} max={key === "gpa" ? 4 : key === "credits" ? 12 : undefined}
              disabled={type === "FINAL_GPA" && key !== "gpa"} value={c[key] ?? ""} placeholder={key === "gpa" ? "Optional" : ""}
              onChange={(e) => setCourses(courses.map((row, j) => j !== i ? row : { ...row, [key]: key === "gpa" ? (e.target.value === "" ? undefined : Number(e.target.value)) : key === "credits" ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value }))} /></label>)}
          {type !== "FINAL_GPA" && <button type="button" className="btn text-no" onClick={() => setCourses(courses.filter((_, j) => j !== i))}>Remove</button>}
        </div>)}</div>
        {type !== "FINAL_GPA" && <button type="button" className="text-sm text-brand" onClick={() => setCourses([...courses, { code: "", name: "", credits: 3 }])}>+ Add course</button>}
      </>}
      <label className="block text-xs text-muted">Evidence description / registrar reference (optional)<textarea className="input mt-1" rows={3} value={evidence} maxLength={8000} onChange={(e) => setEvidence(e.target.value)} /></label>
      <label className="block text-xs text-muted">Supporting document (optional · PDF, PNG, JPEG or text; up to 3 MB)
        <input type="file" className="mt-1 block w-full text-sm" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(e) => void upload(e.target.files?.[0])} />
      </label>
      {file && <p className="text-xs text-brand">Attached: {file.name}</p>}
      {fileError && <p className="text-xs text-no">{fileError}</p>}
      <button type="button" className="btn bg-brand text-white" disabled={submit.isPending || pending
        || ((type === "UNIVERSITY" || type === "MAJOR") ? !value.trim() : invalidCourses) || (type === "FINAL_GPA" && !goal)} onClick={send}>
        {submit.isPending ? "Submitting…" : pending ? "Awaiting admin review" : "Submit verification request"}</button>
      {submit.error && <p className="text-sm text-no">{submit.error.message}</p>}
      {submit.isSuccess && <p className="text-sm text-yes">Request submitted. Your current records remain unchanged until approval.</p>}
    </section>
    <section className="card p-5"><h2 className="mb-3 font-semibold text-ink">My verification requests</h2>
      {requests.length === 0 && <p className="text-sm text-muted">No requests yet.</p>}
      <div className="space-y-3">{requests.map((r) => <div key={r.id} className="rounded-xl border border-line p-4">
        <div className="flex justify-between gap-3 text-sm"><strong>{VERIFICATION_LABELS[r.type]}</strong><span className={r.status === "APPROVED" ? "text-yes" : r.status === "REJECTED" ? "text-no" : "text-gold"}>{r.status.toLowerCase()}</span></div>
        <p className="mt-1 text-xs text-muted">{new Date(r.created_at).toLocaleString()} · {summarize(r)}</p>
        {r.review_note && <p className="mt-2 text-sm text-body">Admin: {r.review_note}</p>}
      </div>)}</div>
    </section>
  </div>;
}
