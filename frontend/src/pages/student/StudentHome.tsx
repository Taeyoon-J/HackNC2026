import { useEffect, useState } from "react";
import { api, type ProfileInput } from "../../api/client";
import type { DisclosureType } from "../../api/types";
import { GoalCard } from "../../components/student/GoalCard";
import { ProfileFields, emptyProfile } from "../../components/student/ProfileFields";
import { RecordEditor } from "../../components/student/RecordEditor";
import { useAction, useMyStudent } from "../../hooks/queries";
import { usd } from "../../lib/format";

const RECORDS: DisclosureType[] = ["GPA_HISTORY", "COURSE_LOAD", "ACTIVITY", "APPLICATION"];

export function StudentHome() {
  const { data: me, error } = useMyStudent();
  const [profile, setProfile] = useState<ProfileInput>(emptyProfile);
  const save = useAction(api.me.updateProfile);

  useEffect(() => {
    if (me) setProfile({ university: me.university, year: me.year, major: me.major });
  }, [me?.id, me?.university, me?.year, me?.major]);

  if (error) return <p className="text-no">{error.message}</p>;
  if (!me) return <div className="card h-64 animate-pulse" />;

  const changed = profile.university !== me.university || profile.year !== me.year || profile.major !== me.major;
  const pending = me.disclosures.filter((d) => !d.verified_at).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft font-display text-2xl font-semibold text-brand">
            {me.name.replace("Student ", "")}
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Hi, {me.name}</h1>
            <p className="text-sm text-muted">
              You appear to the community only as “{me.name}”. Your real name is never shown.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Pill
            label="Status"
            value={me.status === "DELISTED" ? "Not listed" : me.verified ? (pending ? `${pending} update(s) pending` : "Verified") : "Awaiting verification"}
            tone={me.status === "DELISTED" ? "no" : me.verified && !pending ? "yes" : "gold"}
          />
          <Pill label="Scholarships received" value={usd(me.wallet_cents)} tone="gold" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold text-ink">Profile</h2>
            <p className="mb-3 text-xs text-muted">Shown publicly next to your anonymous name.</p>
            <ProfileFields value={profile} onChange={setProfile} />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="btn bg-brand text-white hover:bg-brand-strong"
                disabled={!changed || save.isPending || !profile.university || !profile.major}
                onClick={() => save.mutate(profile)}
              >
                {save.isPending ? "Saving…" : "Save profile"}
              </button>
            </div>
          </section>

          <h2 className="pt-2 font-display text-xl font-semibold text-ink">Academic records</h2>
          <p className="-mt-2 text-sm text-muted">
            Edits are hidden from the community until an admin verifies them.
          </p>
          {RECORDS.map((t) => (
            <RecordEditor key={t} type={t} disclosure={me.disclosures.find((d) => d.type === t)} />
          ))}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <GoalCard markets={me.markets} canPropose={me.status === "ACTIVE"} />
        </div>
      </div>
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: string; tone: "yes" | "no" | "gold" }) {
  const cls = { yes: "bg-yes-soft text-yes", no: "bg-no-soft text-no", gold: "bg-gold-soft text-gold" }[tone];
  return (
    <div className={`rounded-2xl px-4 py-2 ${cls}`}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="num font-semibold">{value}</div>
    </div>
  );
}
