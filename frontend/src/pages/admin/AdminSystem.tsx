import { api } from "../../api/client";
import { DemoGuide } from "../../components/admin/DemoGuide";
import { InvariantsPanel } from "../../components/admin/InvariantsPanel";
import { useAction } from "../../hooks/queries";

export function AdminSystem() {
  const reset = useAction(api.admin.reset);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">System</h1>
          <p className="text-sm text-muted">Ledger health checks and the demo walkthrough.</p>
        </div>
        <button
          type="button"
          className="btn border border-line bg-surface text-body hover:bg-sunken"
          onClick={() => confirm("Reset all data to the seed state?") && reset.mutate(undefined)}
        >
          {reset.isPending ? "Resetting…" : "Reset demo data"}
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DemoGuide />
        <InvariantsPanel />
      </div>
    </div>
  );
}
