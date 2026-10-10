import { useState } from "react";
import type { User } from "../api/types";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Logo } from "../components/layout/Header";
import { ProfileFields, emptyProfile } from "../components/student/ProfileFields";
import { SemesterFields, newCourse, type SemesterInput } from "../components/student/RegistrationRecords";
import { useUsers } from "../hooks/queries";
import { ROLE_HOME, useSession, type Role } from "../store/user";

const ROLES: { role: Role; title: string; blurb: string; icon: string }[] = [
  { role: "STUDENT", title: "Student", blurb: "Submit your academic record for an admin-assigned scholarship goal.", icon: "🎓" },
  { role: "TRADER", title: "Trader", blurb: "Browse student goals and share your forecast with virtual credits.", icon: "📈" },
  { role: "ADMIN", title: "Admin", blurb: "Review evidence, verify academic changes and settle GPA goals.", icon: "🛡️" },
];

export function LoginPage() {
  const [role, setRole] = useState<Role | null>(null);
  const { login } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const enter = (userId: string, r: Role) => {
    qc.clear();
    login(userId, r);
    navigate(ROLE_HOME[r]);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="h-14 w-14" />
          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">Student Performance Exchange</h1>
          <p className="mt-2 text-body">Community-backed scholarships for real academic progress.</p>
        </div>

        <div className="card liquid p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-ink">I am a…</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {ROLES.map((r) => (
              <button
                key={r.role}
                type="button"
                onClick={() => (r.role === "ADMIN" ? enter("ADMIN", "ADMIN") : setRole(r.role))}
                className={`rounded-2xl border p-4 text-left transition hover:border-brand/50 hover:bg-brand-soft/50 ${
                  role === r.role ? "border-brand bg-brand-soft" : "border-line bg-surface"
                }`}
              >
                <div className="text-2xl" aria-hidden>
                  {r.icon}
                </div>
                <div className="mt-2 font-semibold text-ink">{r.title}</div>
                <div className="mt-1 text-xs text-muted">{r.blurb}</div>
              </button>
            ))}
          </div>

          {role === "TRADER" && <AccountPicker role="TRADER" onPick={(id) => enter(id, "TRADER")} />}
          {role === "STUDENT" && <StudentPicker onPick={(id) => enter(id, "STUDENT")} />}
        </div>
        <p className="mt-4 text-center text-xs text-muted">Demo accounts · virtual credits</p>
      </div>
    </div>
  );
}

function AccountPicker({ role, onPick }: { role: Role; onPick: (id: string) => void }) {
  const [credentialUser, setCredentialUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: users = [] } = useUsers();
  // Market-maker bots seed liquidity; they are not demo personas.
  const accounts = users.filter((u) => u.role === role && !u.id.startsWith("MM_"));
  const matching = accounts.filter((u) => `${u.id} ${u.display_name} ${u.username ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="card-title mb-3">Continue as</div>
      {role === "STUDENT" && <label className="mb-3 block text-xs text-muted">Find your demo account
        <input type="search" className="input mt-1" value={search} placeholder="Student name or account ID"
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label>}
      <div className="flex flex-wrap gap-2">
        {matching.slice((page - 1) * 20, page * 20).map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => { if (u.has_password) { setCredentialUser(u); setUsername(u.username ?? u.id); setPassword(""); setLoginError(""); } else onPick(u.id); }}
            className="btn border border-line bg-surface px-4 py-2 text-ink hover:border-brand hover:bg-brand-soft"
          >
            {u.display_name}
          </button>
        ))}
      </div>
      {credentialUser && <form className="mt-4 space-y-3 rounded-xl bg-sunken p-4" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setLoginError("");
        try { const result = await api.account.login({ username, password });
          if (result.role !== role) throw new Error("Select the matching role for this account."); onPick(result.user_id);
        } catch (error) { setLoginError((error as Error).message); } finally { setBusy(false); }
      }}><p className="text-sm font-semibold text-ink">Sign in as {credentialUser.display_name}</p>
        <label className="block text-xs text-muted">Account ID<input className="input mt-1" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label className="block text-xs text-muted">Password<input type="password" className="input mt-1" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="submit" className="btn bg-brand text-white" disabled={busy || !password}>{busy ? "Signing in…" : "Sign in"}</button>
        {loginError && <p className="text-sm text-no">{loginError}</p>}
      </form>}
      {matching.length === 0 && <p className="text-sm text-muted">No accounts found.</p>}
      {matching.length > 20 && <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <button type="button" className="btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>{matching.length} accounts · Page {page} of {Math.ceil(matching.length / 20)}</span>
        <button type="button" className="btn" disabled={page * 20 >= matching.length} onClick={() => setPage(page + 1)}>Next</button>
      </div>}
    </div>
  );
}

function StudentPicker({ onPick }: { onPick: (id: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [profile, setProfile] = useState(emptyProfile);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [history, setHistory] = useState<SemesterInput[]>([]);
  const [noHistory, setNoHistory] = useState(false);
  const [load, setLoad] = useState<SemesterInput>({ term: "Fall 2026", courses: [newCourse()] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!profile.university.trim() || !profile.major.trim()) throw new Error("University and major are required.");
      if (history.length === 0 && !(profile.year === "Freshman" && noHistory)) throw new Error("Enter academic history or declare no completed semesters as a freshman.");
      const s = await api.createStudent({ ...profile, username, password, academic_history: { terms: history }, current_course_load: load });
      await qc.invalidateQueries({ queryKey: ["users"] });
      setMessage(s.message);
      setCreating(false);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <AccountPicker role="STUDENT" onPick={onPick} />
      <div className="mt-5 rounded-2xl bg-sunken p-4">
        {message && <p role="status" className="mb-3 rounded-xl bg-gold-soft p-3 text-sm text-gold">{message}</p>}
        {!creating ? (
          <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setCreating(true)}>
            + New here? Create a student profile
          </button>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void create(); }}>
            <div className="text-sm font-semibold text-ink">Create your profile</div>
            <p className="text-xs text-muted">Your username is your public student name. Choose the name you want traders and admins to see.</p>
            <ProfileFields value={profile} onChange={setProfile} />
            <label className="block text-xs text-muted">Username<input required minLength={3} maxLength={80} pattern="[A-Za-z0-9_.-]+" autoComplete="username" className="input mt-1" value={username} onChange={(e) => setUsername(e.target.value)} /></label>
            <label className="block text-xs text-muted">Password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <h3 className="text-sm font-semibold">Academic history (required)</h3>
            {profile.year === "Freshman" && history.length === 0 && <label className="flex gap-2 text-xs text-muted"><input type="checkbox" checked={noHistory} onChange={(e) => setNoHistory(e.target.checked)} />I have no completed semesters.</label>}
            {history.map((term, index) => <div key={index}><SemesterFields graded value={term} onChange={(value) => setHistory(history.map((t, i) => i === index ? value : t))} /><button type="button" className="text-xs text-no" onClick={() => setHistory(history.filter((_, i) => i !== index))}>Remove semester</button></div>)}
            <button type="button" className="text-xs font-semibold text-brand" disabled={history.length >= 30} onClick={() => { setNoHistory(false); setHistory([...history, { term: "", courses: [newCourse(true)] }]); }}>+ Add completed semester</button>
            <h3 className="text-sm font-semibold">Current course load (required)</h3>
            <SemesterFields value={load} onChange={setLoad} />
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn bg-brand text-white hover:bg-brand-strong"
                disabled={busy || !profile.university.trim() || !profile.major.trim()}
              >
                {busy ? "Submitting…" : "Create account & request verification"}
              </button>
              <button type="button" className="btn text-muted hover:text-ink" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </div>
            {error && <p className="text-xs text-no">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
