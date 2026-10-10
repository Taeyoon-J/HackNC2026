# SPE · Student Performance Exchange (HackNC 2026 demo)

Trade a fixed supply of YES shares on whether a student reaches a semester GPA goal.
Academic changes require evidence and admin approval. Final GPA approval closes trading,
settles shares and pays an adjusted scholarship on both success and failure.
All trading uses virtual credits and all student records are synthetic.

## Run on Windows PowerShell

Run the backend and frontend in separate terminals from this repository:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --reload-dir app --port 8000
```

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` and `/ws` to the backend at port 8000.
Run `npm run dev` inside **frontend**. There is no npm project in the repository root.
On macOS/Linux, use `.venv/bin/python` instead of `.venv\Scripts\python.exe`.

```powershell
# Backend tests (isolated temporary SQLite database)
cd backend
.\.venv\Scripts\python.exe -m pytest -q

# Frontend type checking and production build
cd frontend
npm run build
```

## Accounts and pages

Pick a role and search for a demo account on the login page. Accounts start without
passwords. Student Settings can set an account ID and password; later login for that
account checks the password. Passwords use salted PBKDF2 hashes. Session authorization
remains the demo `X-User-Id` header; this is not production authentication.

| Role | Pages and behavior |
|---|---|
| Student | My profile: read-only university, year, major, current courses and completed grades; edit About me, personal statement, activities and awards. Expand semesters for course codes and grades. Settings: account credentials and academic verification requests with evidence. |
| Trader | Markets: name/ID/profile search, YES Buy/Sell, adjustable hour/day/week/month chart, semester GPA compared with a dashed cohort average. Favorites: saved students. Portfolio: positions and asset allocation chart. Orders: pending limit orders and cancellation. |
| Admin | Verification: oldest-first requests, text/type/status search, proposed changes, evidence and full student profile; approve or reject. Markets: inspect goals and open submitted goals. Students: initial verification and listing controls. System: accounting checks and reset. |

Academic year does not advance automatically in this demo. Completed semesters cannot
be edited, including through verification requests. University, major and course-load
requests apply only after approval. Final grades must include every verified course for
the same semester as the goal; GPA is calculated with course-credit weighting.

## Demo data

The cohort contains **50 students at 10 US universities**. The campus list includes
UNC Chapel Hill, Duke and NC State, plus Princeton, MIT, Harvard, Stanford, Yale,
University of Chicago and Johns Hopkins (the seven highest-ranked other campuses
from the existing 2026 ranking snapshot). These ten demo campuses are not the literal
national top ten. UNC has 8 students, the closest whole-student allocation to the
previous 15% share. The other 42 use a discrete Gaussian (mean 5, standard deviation 2)
over the other campus positions, with at least one student per campus. Seed: 2026.
Sources are in `backend/app/demo_data.py`.

There are 20 majors, random course grades from 0 to 4, credit-weighted semester GPAs,
course breakdowns, Fall 2026 course loads, activities, awards, introductions and personal
statements. Freshmen have no completed college semesters. All 50 seeded students are
listed, including Student F. New signups require university, year, major, academic history,
current course load, a unique username and a password (at least 8 characters).
Freshmen can explicitly declare no completed semesters. Registration creates an inactive account
and a registration request in Admin Verification. Login and student APIs return "Requires verification"
until an admin approves the request. Approval atomically verifies the submitted records, activates
the account and opens a 100-share YES market with a random GPA target (2.0–4.0) and initial
probability (20–80%) for the demo. Students cannot choose their own GPA goals.
The signup username is the student's public display name. Admin Students profiles include
all submitted records, goal GPA, current achievement probability, scholarship details and
current trader holders with share counts, purchase cost and current value.
Public academic records are verified;
About me and personal statements are self-reported and shared immediately across roles.

Trader A starts with YES shares in six students: A, B, C, D, G and H, plus two pending
limit orders. Traders B and C start without holdings. The admin queue has five evidence-backed
requests, including Student A's successful final GPA and Student D's unsuccessful final GPA.

Each active goal issues 100 YES shares. The issuer provides sell inventory and a second
market maker provides bids. Trades transfer existing shares; they never mint extra supply.
NO orders, short selling and orders exceeding the fixed supply are rejected. Holdings plus
pending buys cannot exceed the issued supply; sell orders reserve only owned shares.
Price-time priority, maker-price execution and self-trade prevention still apply.

Market orders use price protection at 99 cents for buys and 1 cent for sells and cancel
any unfilled remainder. Limit orders reserve funds/shares until filled or cancelled.

## Scholarship and final GPA

Each goal starts with a reproducible random scholarship of **$1,000–$1,500**.
There is no scholarship-probability lock step.

Requested demo values persist through reset. Cumulative GPA is calculated from
verified course credits and grades; Student I has no completed semesters.

| Student | Cumulative GPA | Goal GPA | Initial YES forecast |
|---|---:|---:|---:|
| F | 3.66 | 3.8 | 80% |
| G | 3.30 | 3.5 | 50% |
| H | 3.40 | 3.4 | 50% |
| I | None | 3.7 | 30% |
| J | 3.06 | 3.4 | 27% |

To apply these values to an existing database, run
`.\.venv\Scripts\python.exe -m app.demo_overrides` from `backend`.
It backs up the database and records one-share market-maker transfers at the
requested prices, so price charts and order books agree. Later trades can change
the forecast. Human holdings and cost bases are preserved.

- Success: initial scholarship + final YES price (0–1) × $100.
- Failure: initial scholarship − final YES price (0–1) × $100.
- Both outcomes pay the resulting scholarship to the student.
- YES shares pay $1 each on success and $0 on failure.

Final price is the last executed YES price at approval, or the current quote midpoint
when there have been no trades. Approving a final GPA atomically cancels pending orders,
finalizes the transcript, settles shares and pays the scholarship. An already-reviewed
request cannot pay twice. A course-load change after final-grade submission requires a
fresh final-grade request.

To try the workflow, log in as Trader A and inspect Portfolio, Orders and Student A's
market. Log in as Admin, open Verification and inspect Student A's supporting record;
approve it to settle that market. Student A can then see the completed semester and
scholarship receipt. Student D's request demonstrates the failure payout.

## Existing database and reset

For an older six-student database, first expand the cohort, then upgrade the workflow:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.demo_data
.\.venv\Scripts\python.exe -m app.upgrade_workflow
```

Both commands back up `spe.db`. The cohort command keeps students A–50, remaps their
campuses and preserves their records and trades. It removes excess student accounts
and markets after cancelling orders, redeeming human holdings at their last mark and
releasing unused funding. Workflow upgrade preserves existing human YES holdings
and trading history, cancels old binary orders and redeems retired human NO inventory at
its last mark. If existing YES holdings exceed 100, that market retains a larger fixed
supply. Previously settled legacy markets remain historical records. Re-running does not
reissue shares or duplicate demo holdings. New databases seed the full workflow automatically.

**Reset demo data** in Admin → System recreates the full cohort, holdings and requests.

## Layout

```text
backend/app/
  api/                              REST routes and verification review
  services/order_service.py         validation, reservation, matching, cancellation
  services/fixed_market_service.py   YES issuance, funding and demo holdings
  services/verification_service.py   evidence validation and atomic academic approval
  services/settlement_service.py     final GPA, share and scholarship payouts
  services/ledger_service.py         double-entry ledger and wallet reservations
  services/invariants.py             supply, collateral, ledger and reservation checks
  schema.py                         additive schema migration
  demo_data.py                      university catalog and synthetic academic records
  upgrade_workflow.py               backed-up migration for existing databases
frontend/src/
  components/                       student, market, trading, portfolio and admin UI
  pages/                            login and role-specific pages
  hooks/                            query cache and WebSocket refresh
```

Legacy binary matching remains covered by regression fixtures; newly issued demo goals
use only the fixed YES workflow.
