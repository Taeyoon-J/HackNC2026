import type { ProfileInput } from "../../api/client";

export const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];
export const emptyProfile: ProfileInput = { university: "", year: "Freshman", major: "" };

export function ProfileFields({ value, onChange }: { value: ProfileInput; onChange: (v: ProfileInput) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block text-xs text-muted">
        University
        <input
          className="input mt-1"
          value={value.university}
          placeholder="UNC Chapel Hill"
          onChange={(e) => onChange({ ...value, university: e.target.value })}
        />
      </label>
      <label className="block text-xs text-muted">
        Year
        <select className="input mt-1" value={value.year} onChange={(e) => onChange({ ...value, year: e.target.value })}>
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
          placeholder="Computer Science"
          onChange={(e) => onChange({ ...value, major: e.target.value })}
        />
      </label>
    </div>
  );
}
