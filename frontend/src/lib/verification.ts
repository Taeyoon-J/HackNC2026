import type { Verification, VerificationType } from "../api/types";

export const VERIFICATION_LABELS: Record<VerificationType, string> = {
  REGISTRATION: "Student account activation",
  UNIVERSITY: "University change",
  MAJOR: "Major change",
  COURSE_LOAD: "Current course load / course grades",
  FINAL_GPA: "Final semester GPA",
  BIOGRAPHY: "Introduction & personal statement",
  ACTIVITY: "Activities update",
  APPLICATION: "Applications & awards update",
};

/** Types a student can file from Settings; the rest are created by edits on My profile. */
export const SETTINGS_TYPES: VerificationType[] = ["UNIVERSITY", "MAJOR", "COURSE_LOAD", "FINAL_GPA"];

export function summarize(r: Verification): string {
  const p = r.payload;
  if (r.type === "REGISTRATION") return `${p.university} · ${p.year} · ${p.major}`;
  if (p.value) return p.value;
  if (r.type === "BIOGRAPHY") return "Profile text edited";
  if (r.type === "ACTIVITY" || r.type === "APPLICATION") return `${p.data?.items?.length ?? 0} entries`;
  return [p.term, p.gpa !== undefined ? `GPA ${p.gpa.toFixed(2)}` : null].filter(Boolean).join(" · ");
}
