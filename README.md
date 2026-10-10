# SPE · Student Performance Exchange (HackNC 2026 demo)

Trade binary YES/NO contracts on whether a student hits an academic goal. The market-implied
difficulty sets a scholarship that is paid to the student if they succeed.
All trading uses virtual credits; all student data is synthetic.

## Running

```bash
# Backend (http://localhost:8000, seeds demo data on first start)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend (http://localhost:5173, proxies /api and /ws to :8000)
cd frontend
npm install && npm run dev
```

Tests: `cd backend && .venv/bin/python -m pytest -q`
Reset data: "Reset demo data" on the Admin page, or delete `backend/spe.db` and restart.

## Demo script

Switch users with the dropdown in the top-right. The Admin page has an "End-to-end demo script"
card with one-click shortcuts for each step.

1. Trader A: on `STU001`, limit buy 100 YES @ 60¢ (rests on the book)
2. Trader B: buy 100 NO @ 40¢ → **MINT** 100 pairs, $100 collateral
3. Trader A: sell 50 YES @ 61¢ → Trader C: buy 50 YES @ 61¢ → **TRANSFER_YES**
4. Admin: lock at 30% → $1,466.85 scholarship → start trading → approve GPA 3.85 → settle

## Layout

```
backend/app/
  services/matching_engine.py      single YES book normalization, trade type (MINT/TRANSFER/BURN) — pure logic
  services/order_service.py        validation, reservation, matching, cancel (1 order = 1 DB transaction)
  services/ledger_service.py       double-entry ledger, wallet reservations
  services/market_service.py       state machine DRAFT→…→SETTLED, stats/VWAP
  services/scholarship_service.py  scholarship formula, VWAP-based lock, separate reserve
  services/settlement_service.py   resolution, contract + scholarship payout (idempotent)
  services/invariants.py           supply, collateral, ledger and reservation checks
  api/                             REST routers (spec §8) + /ws WebSocket
  seed.py                          5 students, 5 markets, market-maker trade history
frontend/src/
  pages/        MarketDirectory · MarketPage · PortfolioPage · AdminPage
  components/   layout · market · student · trading · portfolio · admin
  hooks/        TanStack Query hooks, WebSocket → query invalidation
```

### Matching rules

| BID \ ASK | YES SELL | NO BUY |
|---|---|---|
| **YES BUY** | TRANSFER_YES | MINT |
| **NO SELL** | BURN | TRANSFER_NO |

- Price-time priority; trades execute at the maker's price. The taker's price improvement is refunded from their reservation.
- MARKET orders are limits at 99¢/1¢ (price protection); any unfilled remainder is cancelled.
- Orders that would cross the user's own resting order are rejected (self-trade prevention).
- Auth is demo-only: the `X-User-Id` header.
