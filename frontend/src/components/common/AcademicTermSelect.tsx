const CURRENT = (() => {
  const date = new Date();
  return { year: date.getFullYear(), season: date.getMonth() < 6 ? 1 : 2 };
})();

export const ACADEMIC_TERMS = Array.from({ length: 9 }, (_, offset) => {
  const serial = CURRENT.year * 2 + CURRENT.season - 1 - offset;
  return `${serial % 2 === 0 ? "Spring" : "Fall"} ${Math.floor(serial / 2)}`;
});

export function AcademicTermSelect({ value, onChange, label = "Semester", disabled = false }: {
  value: string; onChange: (value: string) => void; label?: string; disabled?: boolean;
}) {
  const terms = value && !ACADEMIC_TERMS.includes(value) ? [value, ...ACADEMIC_TERMS] : ACADEMIC_TERMS;
  return <label className="block text-xs text-muted">{label}<select required className="input mt-1" disabled={disabled} value={value}
    onChange={(e) => onChange(e.target.value)}><option value="" disabled>Select a semester</option>{terms.map((term) => <option key={term}>{term}</option>)}</select></label>;
}
