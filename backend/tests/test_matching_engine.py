from types import SimpleNamespace as O

from app.services.matching_engine import (ASK, BID, aggregate_levels, contract_price, normalize,
                                          trade_type)
from app.services.scholarship_service import calculate_scholarship


def test_normalize_maps_all_four_intents():
    assert normalize("YES", "BUY", 60) == (BID, 60)
    assert normalize("YES", "SELL", 60) == (ASK, 60)
    assert normalize("NO", "BUY", 40) == (ASK, 60)
    assert normalize("NO", "SELL", 40) == (BID, 60)


def test_trade_type_matrix():
    yb, ys, nb, ns = (O(contract=c, action=a) for c, a in
                      [("YES", "BUY"), ("YES", "SELL"), ("NO", "BUY"), ("NO", "SELL")])
    assert trade_type(yb, ys) == "TRANSFER_YES"
    assert trade_type(yb, nb) == "MINT"
    assert trade_type(ns, ys) == "BURN"
    assert trade_type(ns, nb) == "TRANSFER_NO"


def test_contract_price():
    assert contract_price("YES", 62) == 62
    assert contract_price("NO", 62) == 38


def test_aggregate_levels_sorted():
    orders = [O(book_side=BID, yes_price_cents=p, remaining=q) for p, q in [(57, 300), (60, 100), (60, 5)]]
    orders += [O(book_side=ASK, yes_price_cents=p, remaining=q) for p, q in [(65, 80), (62, 150)]]
    book = aggregate_levels(orders)
    assert [(l.price, l.quantity, l.orders) for l in book["bids"]] == [(60, 105, 2), (57, 300, 1)]
    assert [l.price for l in book["asks"]] == [62, 65]


def test_scholarship_formula():
    assert calculate_scholarship(0.30) == 1466.85
    assert calculate_scholarship(0.5) == 1000
    assert calculate_scholarship(0.01) == calculate_scholarship(0.10)
    assert calculate_scholarship(0.10) <= 3000
