const MONTHS = [
  { month: "May", base: 180, additional: 0 },
  { month: "Jun", base: 420, additional: 65 },
  { month: "Jul", base: 790, additional: 190 },
  { month: "Aug", base: 1260, additional: 380 },
  { month: "Sep", base: 2050, additional: 690 },
  { month: "Oct", base: 2880, additional: 1040 },
];

const BLUE = "#7297ed";
const GREEN = "#86bf83";
const MAX = 4500;
const TOP = 30;
const BASE = 260;
const HEIGHT = BASE - TOP;

export function CumulativeSponsorshipChart() {
  const y = (value: number) => BASE - value / MAX * HEIGHT;
  return <div className="space-y-3">
    <div className="overflow-x-auto">
      <svg viewBox="0 0 700 330" className="min-w-[620px] w-full" role="img" aria-label="Demo cumulative sponsorship impact by month">
        {[0, 1000, 2000, 3000, 4000].map((value) => <g key={value}>
          <line x1="58" x2="685" y1={y(value)} y2={y(value)} stroke="#e8e1d6" strokeDasharray={value ? "3 4" : undefined} />
          <text x="48" y={y(value) + 4} textAnchor="end" fill="#6b7280" fontSize="11">${value.toLocaleString()}</text>
        </g>)}
        {MONTHS.map((row, index) => {
          const x = 95 + index * 98;
          const width = 68;
          const baseY = y(row.base);
          const totalY = y(row.base + row.additional);
          return <g key={row.month}>
            <rect x={x} y={baseY} width={width} height={BASE - baseY} fill={BLUE} rx="5"><title>{row.month}: Cumulative Base Sponsorship ${row.base.toLocaleString()}</title></rect>
            {row.additional > 0 && <rect x={x} y={totalY} width={width} height={baseY - totalY} fill={GREEN} rx="5"><title>{row.month}: Cumulative Additional Impact ${row.additional.toLocaleString()}</title></rect>}
            <text x={x + width / 2} y="283" textAnchor="middle" fill="#6b7280" fontSize="12">{row.month}</text>
          </g>;
        })}
        <g fontSize="12" fill="#343a40">
          <circle cx="215" cy="315" r="5" fill={BLUE} /><text x="228" y="319">Cumulative Base Sponsorship</text>
          <circle cx="432" cy="315" r="5" fill={GREEN} /><text x="445" y="319">Cumulative Additional Impact</text>
        </g>
      </svg>
    </div>
    <p className="text-xs text-muted">Illustrative monthly estimates for Trader A, B, and C.</p>
  </div>;
}
