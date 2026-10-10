import type { ProfileInput } from "../../api/client";
import { SearchableSelect } from "../common/SearchableSelect";
import { MAJORS, UNIVERSITIES } from "../../lib/academicOptions";

export const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];
export const emptyProfile: ProfileInput = { university: "", year: "Freshman", major: "", introduction: "", pitch: "" };

export function ProfileFields({ value, onChange, fixed = false }: { value: ProfileInput; onChange: (v: ProfileInput) => void; fixed?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SearchableSelect label="University" value={value.university} disabled={fixed} options={UNIVERSITIES}
        placeholder="Search U.S. universities" onChange={(university) => onChange({ ...value, university })} />
      <label className="block text-xs text-muted">
        Year
        <select className="input mt-1" disabled={fixed} value={value.year} onChange={(e) => onChange({ ...value, year: e.target.value })}>
          {YEARS.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      <SearchableSelect label="Major" value={value.major} disabled={fixed} options={MAJORS}
        placeholder="Search majors" onChange={(major) => onChange({ ...value, major })} />
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
