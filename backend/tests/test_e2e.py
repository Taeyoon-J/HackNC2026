"""Spec §10 end-to-end demo plus the Phase 4 edge cases."""
from app.seed import TRADER_CREDITS
from conftest import M1, as_user, assert_invariants, order


def test_spec_end_to_end(client):
    admin = as_user(client, "ADMIN")

    student = client.get("/api/students/STU001").json()
    assert {d["type"] for d in student["disclosures"]} >= {"GPA_HISTORY", "COURSE_LOAD"}

    # Trader A bids YES 100 @ 60 — rests (best ask is 62).
    r = order(client, "TRADER_A", "YES", "BUY", 60, 100).json()
    assert r["filled_quantity"] == 0 and r["order"]["status"] == "OPEN"

    # Trader B buys NO 100 @ 40 → matches A's bid → 100 pairs minted, $100 collateral.
    before = client.get(f"/api/markets/{M1}").json()
    r = order(client, "TRADER_B", "NO", "BUY", 40, 100).json()
    assert r["filled_quantity"] == 100 and r["trades"][0]["trade_type"] == "MINT"
    after = client.get(f"/api/markets/{M1}").json()
    assert after["minted_pairs"] - before["minted_pairs"] == 100
    assert after["collateral_cents"] - before["collateral_cents"] == 100_00

    # Trader C buys part of A's existing YES → transfer, no new collateral.
    order(client, "TRADER_A", "YES", "SELL", 61, 50)
    r = order(client, "TRADER_C", "YES", "BUY", 61, 50).json()
    assert r["trades"][0]["trade_type"] == "TRANSFER_YES"
    assert client.get(f"/api/markets/{M1}").json()["minted_pairs"] == after["minted_pairs"]
    assert_invariants(client)

    # Admin locks at 30% → ~$1,467 scholarship.
    lock = admin("POST", f"/api/admin/markets/{M1}/lock", json={"probability": 0.30}).json()
    assert lock["scholarship"]["promised_cents"] == 1466_85
    admin("POST", f"/api/admin/markets/{M1}/start-trading")

    # GPA 3.85 → YES wins.
    r = admin("POST", f"/api/admin/markets/{M1}/resolve", json={"value": 3.85}).json()
    assert r["outcome"] == "YES"
    wallet_a = as_user(client, "TRADER_A")("GET", "/api/portfolio").json()["available_cents"]
    result = admin("POST", f"/api/admin/markets/{M1}/settle").json()
    assert result["scholarship_paid_cents"] == 1466_85

    a = as_user(client, "TRADER_A")("GET", "/api/portfolio").json()
    assert a["available_cents"] - wallet_a == 50 * 100  # A kept 50 YES
    users = {u["id"]: u for u in client.get("/api/users").json()}
    assert users["STUDENT_A"]["available_cents"] == 1466_85

    # Double settlement is rejected.
    assert admin("POST", f"/api/admin/markets/{M1}/settle").status_code == 400
    assert_invariants(client)


def test_sweep_matches_spec_example(client):
    # Spec §3: buy YES 200 @ 63 → 150 @ 62 + 50 @ 63, $124.50, avg 62.25¢.
    r = order(client, "TRADER_A", "YES", "BUY", 63, 200).json()
    assert [(t["yes_price"], t["quantity"]) for t in r["trades"]] == [(62, 150), (63, 50)]
    assert r["total_cents"] == 124_50 and r["avg_price_cents"] == 62.25
    p = as_user(client, "TRADER_A")("GET", "/api/portfolio").json()
    assert p["reserved_cents"] == 0 and p["available_cents"] == TRADER_CREDITS - 124_50
    assert_invariants(client)


def test_partial_fill_then_cancel_releases_reservation(client):
    r = order(client, "TRADER_A", "YES", "BUY", 62, 200).json()
    assert r["filled_quantity"] == 150 and r["order"]["status"] == "PARTIAL"
    p = as_user(client, "TRADER_A")("GET", "/api/portfolio").json()
    assert p["reserved_cents"] == 50 * 62
    as_user(client, "TRADER_A")("DELETE", f"/api/orders/{r['order']['id']}")
    p = as_user(client, "TRADER_A")("GET", "/api/portfolio").json()
    assert p["reserved_cents"] == 0 and p["available_cents"] == TRADER_CREDITS - 150 * 62
    assert_invariants(client)


def test_market_order_cancels_remainder(client):
    r = order(client, "TRADER_A", "YES", "BUY", None, 1000, order_type="MARKET").json()
    assert r["filled_quantity"] == 430 and r["order"]["status"] == "CANCELLED"
    assert as_user(client, "TRADER_A")("GET", "/api/portfolio").json()["reserved_cents"] == 0
    assert_invariants(client)


def test_insufficient_balance_and_inventory(client):
    assert order(client, "TRADER_A", "YES", "BUY", 50, TRADER_CREDITS).status_code == 400
    assert order(client, "TRADER_A", "YES", "SELL", 70, 1).status_code == 400
    assert_invariants(client)


def test_burn_and_no_transfer(client):
    order(client, "TRADER_A", "YES", "BUY", 60, 100)
    order(client, "TRADER_B", "NO", "BUY", 40, 100)            # MINT: A holds YES, B holds NO

    # B sells NO 20 @ 38 → bid 62 hits the MM's resting NO BUY ask at 62 → NO changes hands.
    r = order(client, "TRADER_B", "NO", "SELL", 38, 20).json()
    assert [t["trade_type"] for t in r["trades"]] == ["TRANSFER_NO"]

    # A offers YES @ 61 (inside the spread); B sells NO @ 39 (= bid 61) → both holders exit → BURN.
    before = client.get(f"/api/markets/{M1}").json()
    order(client, "TRADER_A", "YES", "SELL", 61, 10)
    r = order(client, "TRADER_B", "NO", "SELL", 39, 10).json()
    assert [t["trade_type"] for t in r["trades"]] == ["BURN"]
    after = client.get(f"/api/markets/{M1}").json()
    assert after["minted_pairs"] == before["minted_pairs"] - 10
    assert after["collateral_cents"] == before["collateral_cents"] - 10 * 100
    assert_invariants(client)


def test_self_trade_and_status_guards(client):
    order(client, "TRADER_A", "YES", "BUY", 60, 10)
    assert order(client, "TRADER_A", "NO", "BUY", 40, 10).status_code == 400
    assert order(client, "TRADER_A", "YES", "BUY", 60, 10, market="STU005-GPA-2026S").status_code == 400
    assert order(client, "STUDENT_A", "YES", "BUY", 60, 10).status_code == 403
    assert as_user(client, "TRADER_A")("POST", f"/api/admin/markets/{M1}/lock", json={}).status_code == 403
