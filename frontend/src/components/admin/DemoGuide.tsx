import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useUserStore } from "../../store/user";

const M = "STU001-GPA-2026F";

const STEPS: { as?: string; text: string; link?: string }[] = [
  { text: "Review Student A's disclosures and the GPA ≥ 3.8 market", link: `/markets/${M}` },
  { as: "TRADER_A", text: "Limit buy 100 YES @ 60¢ → rests as the best bid", link: `/markets/${M}` },
  { as: "TRADER_B", text: "Buy 100 NO @ 40¢ → matches A, mints 100 pairs (MINT), $100 collateral", link: `/markets/${M}` },
  { as: "TRADER_A", text: "Sell 50 YES @ 61¢", link: `/markets/${M}` },
  { as: "TRADER_C", text: "Buy 50 YES @ 61¢ → existing contracts change hands (TRANSFER_YES), collateral unchanged", link: `/markets/${M}` },
  { as: "ADMIN", text: "Enter 30% probability and Lock → scholarship ≈ $1,467", link: `/admin?market=${M}` },
  { as: "ADMIN", text: "Start trading → approve GPA 3.85 result (YES)", link: `/admin?market=${M}` },
  { as: "ADMIN", text: "Settle → $1 per YES contract, scholarship paid to Student A", link: `/admin?market=${M}` },
];

const NAMES: Record<string, string> = { TRADER_A: "Trader A", TRADER_B: "Trader B", TRADER_C: "Trader C", ADMIN: "Admin" };

export function DemoGuide() {
  const { userId, setUserId } = useUserStore();
  const qc = useQueryClient();
  return (
    <div className="card p-5">
      <div className="card-title mb-3">End-to-end demo script</div>
      <ol className="space-y-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sunken text-[11px]">{i + 1}</span>
            <div className="flex-1 text-body">
              {s.as && (
                <button
                  type="button"
                  onClick={() => {
                    setUserId(s.as!);
                    qc.invalidateQueries();
                  }}
                  className={`mr-2 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    userId === s.as ? "bg-brand text-white" : "bg-brand-soft text-brand hover:bg-brand/15"
                  }`}
                >
                  {NAMES[s.as]}
                </button>
              )}
              {s.link ? (
                <Link to={s.link} className="hover:text-ink hover:underline">
                  {s.text}
                </Link>
              ) : (
                s.text
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
