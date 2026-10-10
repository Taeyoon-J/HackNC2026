import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Logo } from "../components/layout/Header";
import { ProfileFields, emptyProfile } from "../components/student/ProfileFields";
import { useUsers } from "../hooks/queries";
import { ROLE_HOME, useSession, type Role } from "../store/user";

const ROLES: { role: Role; title: string; blurb: string; icon: string }[] = [
  { role: "STUDENT", title: "Student", blurb: "Share your academic record and set a goal to earn a scholarship.", icon: "🎓" },
  { role: "TRADER", title: "Trader", blurb: "Browse student goals and share your forecast with virtual credits.", icon: "📈" },
  { role: "ADMIN", title: "Admin", blurb: "Verify students, price scholarships and resolve outcomes.", icon: "🛡️" },
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-soft via-canvas to-gold-soft px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="h-14 w-14" />
          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">Student Performance Exchange</h1>
          <p className="mt-2 text-body">Community-backed scholarships for real academic progress.</p>
        </div>

        <div className="card p-6 sm:p-8">
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
        <p className="mt-4 text-center text-xs text-muted">Demo only · no password needed · virtual credits</p>
      </div>
    </div>
  );
}

function AccountPicker({ role, onPick }: { role: Role; onPick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: users = [] } = useUsers();
  // Market-maker bots seed liquidity; they are not demo personas.
  const accounts = users.filter((u) => u.role === role && !u.id.startsWith("MM_"));
  const matching = accounts.filter((u) => `${u.id} ${u.display_name}`.toLowerCase().includes(search.toLowerCase()));
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
            onClick={() => onPick(u.id)}
            className="btn border border-line bg-surface px-4 py-2 text-ink hover:border-brand hover:bg-brand-soft"
          >
            {u.display_name}
          </button>
        ))}
      </div>
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
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const create = async () => {
    setError(null);
    try {
      const s = await api.createStudent(profile);
      await qc.invalidateQueries({ queryKey: ["users"] });
      onPick(s.user_id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <AccountPicker role="STUDENT" onPick={onPick} />
      <div className="mt-5 rounded-2xl bg-sunken p-4">
        {!creating ? (
          <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setCreating(true)}>
            + New here? Create a student profile
          </button>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-ink">Create your profile</div>
            <p className="text-xs text-muted">You will be listed anonymously (e.g. "Student G"). Your name is never shown.</p>
            <ProfileFields value={profile} onChange={setProfile} />
            <div className="flex gap-2">
              <button
                type="button"
                className="btn bg-brand text-white hover:bg-brand-strong"
                disabled={!profile.university || !profile.major}
                onClick={create}
              >
                Create & continue
              </button>
              <button type="button" className="btn text-muted hover:text-ink" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </div>
            {error && <p className="text-xs text-no">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
