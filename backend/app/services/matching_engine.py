"""Pure order-book rules. No DB access, so this is the place to unit test.

All orders share one book priced in YES cents:
    YES BUY  @p -> BID p          NO SELL @p -> BID 100-p
    YES SELL @p -> ASK p          NO BUY  @p -> ASK 100-p

The original (contract, action) is kept on every order, and the pair of
intents on each side of a match decides what actually happens:

                  | ASK: YES SELL   | ASK: NO BUY
    BID: YES BUY  | TRANSFER_YES    | MINT
    BID: NO SELL  | BURN            | TRANSFER_NO
"""
from dataclasses import dataclass

YES, NO = "YES", "NO"
BUY, SELL = "BUY", "SELL"
BID, ASK = "BID", "ASK"
LIMIT, MARKET = "LIMIT", "MARKET"

_TRADE_TYPES = {
    ((YES, BUY), (YES, SELL)): "TRANSFER_YES",
    ((YES, BUY), (NO, BUY)): "MINT",
    ((NO, SELL), (YES, SELL)): "BURN",
    ((NO, SELL), (NO, BUY)): "TRANSFER_NO",
}


def normalize(contract: str, action: str, price_cents: int) -> tuple[str, int]:
    """Map an order onto the YES book: returns (book_side, yes_price_cents)."""
    yes_price = price_cents if contract == YES else 100 - price_cents
    is_bid = (contract == YES) == (action == BUY)
    return (BID if is_bid else ASK), yes_price


def contract_price(contract: str, yes_price_cents: int) -> int:
    """Price of one `contract` when the YES book trades at `yes_price_cents`."""
    return yes_price_cents if contract == YES else 100 - yes_price_cents


def trade_type(bid, ask) -> str:
    return _TRADE_TYPES[((bid.contract, bid.action), (ask.contract, ask.action))]


def opposite(side: str) -> str:
    return ASK if side == BID else BID


def crosses(side: str, yes_price: int, resting_yes_price: int) -> bool:
    return resting_yes_price <= yes_price if side == BID else resting_yes_price >= yes_price


@dataclass
class Level:
    price: int
    quantity: int
    orders: int


def aggregate_levels(orders) -> dict:
    """Collapse resting orders into price levels. Bids high→low, asks low→high."""
    books: dict[str, dict[int, Level]] = {BID: {}, ASK: {}}
    for o in orders:
        lvl = books[o.book_side].setdefault(o.yes_price_cents, Level(o.yes_price_cents, 0, 0))
        lvl.quantity += o.remaining
        lvl.orders += 1
    bids = sorted(books[BID].values(), key=lambda l: -l.price)
    asks = sorted(books[ASK].values(), key=lambda l: l.price)
    return {"bids": bids, "asks": asks}
