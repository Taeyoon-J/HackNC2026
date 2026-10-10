import type { ProfileInput } from "../../api/client";

export const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];
export const emptyProfile: ProfileInput = { university: "", year: "Freshman", major: "", introduction: "", pitch: "" };

export function ProfileFields({ value, onChange, fixed = false }: { value: ProfileInput; onChange: (v: ProfileInput) => void; fixed?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block text-xs text-muted">
        University
        <input
          className="input mt-1"
          value={value.university}
          disabled={fixed}
          placeholder="UNC Chapel Hill"
          onChange={(e) => onChange({ ...value, university: e.target.value })}
        />
      </label>
      <label className="block text-xs text-muted">
        Year
        <select className="input mt-1" disabled={fixed} value={value.year} onChange={(e) => onChange({ ...value, year: e.target.value })}>
          {YEARS.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted">
        Major
        <input
          className="input mt-1"
          value={value.major}
          disabled={fixed}
          placeholder="Computer Science"
          onChange={(e) => onChange({ ...value, major: e.target.value })}
        />
      </label>
      <label className="block text-xs text-muted sm:col-span-3">
        About me
        <textarea className="input mt-1" rows={3} maxLength={4000} value={value.introduction ?? ""}
          placeholder="Introduce yourself, your interests and your academic journey."
          onChange={(e) => onChange({ ...value, introduction: e.target.value })} />
      </label>
      <label className="block text-xs text-muted sm:col-span-3">
        Personal statement / Why back me?
        <textarea className="input mt-1" rows={4} maxLength={4000} value={value.pitch ?? ""}
          placeholder="Share your goals, study plan and how a scholarship would help."
          onChange={(e) => onChange({ ...value, pitch: e.target.value })} />
        <span className="mt-1 block">Your introduction and personal statement are self-reported and visible to traders and admins.</span>
      </label>
    </div>
  );
}
