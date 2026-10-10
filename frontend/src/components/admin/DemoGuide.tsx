import { Link } from "react-router-dom";

export function DemoGuide() {
  return <section className="card space-y-3 p-5"><h2 className="font-semibold text-ink">Demo walkthrough</h2>
    <ol className="list-inside list-decimal space-y-2 text-sm text-body">
      <li>Student A: inspect read-only semester grades and submit academic changes in Settings.</li>
      <li>Trader A: inspect six seeded YES holdings, allocation and two pending limit orders.</li>
      <li>Favorite a student market and inspect the Favorites tab.</li>
      <li>Admin: review evidence in Verification. Approve university, major or course-load requests.</li>
      <li>Approve Student A's final GPA for a success payout, or Student D's for a missed-goal payout.</li>
    </ol>
    <Link to="/admin/verification" className="block text-sm font-semibold text-brand">Open verification queue →</Link>
    <p className="text-xs text-muted">Reset restores the 50-student cohort, pending verification examples and Trader A's portfolio.</p>
  </section>;
}
