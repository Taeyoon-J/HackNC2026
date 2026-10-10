"""Order intake, matching against the DB-backed book, and cancellation.

Endpoints run on a single asyncio event loop and this module does no awaiting,
so each place/cancel call is effectively serialized per process. Each call is
also exactly one DB transaction (commit at the end, rollback on error).
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import DomainError, utcnow
from ..models import Market, Order, Position, Student, Trade, User
from . import ledger_service as ledger
from .matching_engine import (BID, BUY, LIMIT, MARKET, NO, SELL, YES, contract_price, crosses,
                              normalize, opposite, trade_type)

TRADABLE_STATUSES = {"PRICE_DISCOVERY", "SCHOLARSHIP_LOCKED", "TRADING"}
OPEN_STATUSES = ("OPEN", "PARTIAL")


def position(db: Session, user_id: str, market_id: str, contract: str) -> Position:
    pos = db.get(Position, (user_id, market_id, contract))
    if pos is None:
        pos = Position(user_id=user_id, market_id=market_id, contract=contract,
                       quantity=0, reserved_qty=0, cost_basis_cents=0)
        db.add(pos)
        db.flush()
    return pos


def place_order(db: Session, user_id: str, market_id: str, contract: str, action: str,
                order_type: str, price_cents: int | None, quantity: int,
                now=None) -> tuple[Order, list[Trade]]:
    now = now or utcnow()
    try:
        order, trades = _place(db, user_id, market_id, contract, action, order_type,
                               price_cents, quantity, now)
        db.commit()
        return order, trades
    except Exception:
        db.rollback()
        raise


def _place(db, user_id, market_id, contract, action, order_type, price_cents, quantity, now, admin_backed=False):
    user = db.get(User, user_id)
    if user is None or user.role != "TRADER":
        raise DomainError("Only traders can place orders", 403)
    market = db.get(Market, market_id)
    if market is None:
        raise DomainError("Market not found", 404)
    if market.status not in TRADABLE_STATUSES:
        raise DomainError(f"Trading is not allowed while the market is {market.status}")
    if db.get(Student, market.student_id).status != "ACTIVE":
        raise DomainError("This student is not currently listed")
    if contract not in (YES, NO) or action not in (BUY, SELL) or order_type not in (LIMIT, MARKET):
        raise DomainError("Invalid order")
    if not isinstance(quantity, int) or quantity <= 0:
        raise DomainError("Quantity must be a positive integer")
    if market.total_supply:
        if contract != YES:
            raise DomainError("This market supports YES shares only")
        if quantity > market.total_supply:
            raise DomainError(f"This market has only {market.total_supply} issued shares")
        if action == BUY:
            held = position(db, user_id, market_id, YES).quantity
            queued = db.scalar(select(func.coalesce(func.sum(Order.remaining), 0)).where(
                Order.market_id == market_id, Order.user_id == user_id, Order.contract == YES,
                Order.action == BUY, Order.status.in_(OPEN_STATUSES)))
            if quantity + held + queued > market.total_supply:
                raise DomainError(f"At most {market.total_supply - held - queued} shares are available after your holdings and pending buys")
    ceiling = market.share_value_cents - 1
    if order_type == MARKET:
        # Price-protection bound: a market order is a limit at the widest legal price.
        price_cents = ceiling if action == BUY else 1
    elif price_cents is None or not 1 <= price_cents <= ceiling:
        raise DomainError(f"Price must be between {_money(1)} and {_money(ceiling)}")

    side, yes_price = normalize(contract, action, price_cents)
    _reject_self_cross(db, market_id, user_id, side, yes_price)

    if action == BUY:
        ledger.reserve_cash(db, user_id, price_cents * quantity)
    else:
        pos = position(db, user_id, market_id, contract)
        if pos.quantity - pos.reserved_qty < quantity:
            raise DomainError(f"Not enough {contract} to sell (available {pos.quantity - pos.reserved_qty})")
        pos.reserved_qty += quantity

    order = Order(market_id=market_id, user_id=user_id, contract=contract, action=action,
                  order_type=order_type, price_cents=price_cents, book_side=side,
                  yes_price_cents=yes_price, quantity=quantity, remaining=quantity,
                  status="OPEN", created_at=now, admin_backed=admin_backed)
    db.add(order)
    db.flush()

    trades = _match(db, market, order, now)

    if order.remaining > 0 and order_type == MARKET:
        _release(db, order)
        order.status = "CANCELLED"
    return order, trades


def _money(cents: int) -> str:
    return f"${cents / 100:,.2f}"


def _reject_self_cross(db, market_id, user_id, side, yes_price):
    resting = db.scalars(select(Order).where(
        Order.market_id == market_id, Order.user_id == user_id,
        Order.book_side == opposite(side), Order.status.in_(OPEN_STATUSES))).all()
    if any(crosses(side, yes_price, o.yes_price_cents) for o in resting):
        raise DomainError("Order would match your own resting order (self-trade prevention)")


def _match(db: Session, market: Market, order: Order, now) -> list[Trade]:
    q = select(Order).where(Order.market_id == market.id,
                            Order.book_side == opposite(order.book_side),
                            Order.status.in_(OPEN_STATUSES))
    if order.book_side == BID:
        q = q.where(Order.yes_price_cents <= order.yes_price_cents).order_by(
            Order.yes_price_cents.asc(), Order.created_at.asc(), Order.id.asc())
    else:
        q = q.where(Order.yes_price_cents >= order.yes_price_cents).order_by(
            Order.yes_price_cents.desc(), Order.created_at.asc(), Order.id.asc())

    trades = []
    for resting in db.scalars(q).all():
        if order.remaining == 0:
            break
        qty = min(order.remaining, resting.remaining)
        trades.append(_execute(db, market, maker=resting, taker=order,
                               price=resting.yes_price_cents, qty=qty, now=now))
    return trades


def _execute(db, market: Market, maker: Order, taker: Order, price: int, qty: int, now) -> Trade:
    bid, ask = (taker, maker) if taker.book_side == BID else (maker, taker)
    ttype = trade_type(bid, ask)
    if market.total_supply and ttype != "TRANSFER_YES":
        raise DomainError("Fixed-supply shares can only be transferred; new shares cannot be minted")
    trade = Trade(market_id=market.id, maker_order_id=maker.id, taker_order_id=taker.id,
                  trade_type=ttype, taker_side=taker.book_side, yes_price_cents=price,
                  quantity=qty, executed_at=now)
    db.add(trade)
    db.flush()

    entries: list[tuple[str, int]] = []
    for o in (bid, ask):
        cp = contract_price(o.contract, price)
        pos = position(db, o.user_id, market.id, o.contract)
        if o.action == BUY:
            # Release this slice of the reservation at the order's limit price, then
            # debit the actual cost; the difference is the price improvement refund.
            ledger.release_cash(db, o.user_id, o.price_cents * qty)
            entries.append((ledger.user_account(o.user_id), -cp * qty))
            pos.quantity += qty
            pos.cost_basis_cents += cp * qty
        else:
            pos.cost_basis_cents -= pos.cost_basis_cents * qty // pos.quantity
            pos.quantity -= qty
            pos.reserved_qty -= qty
            entries.append((ledger.user_account(o.user_id), cp * qty))
        o.remaining -= qty
        o.status = "FILLED" if o.remaining == 0 else "PARTIAL"

    for o in (bid, ask):
        if not o.admin_backed:
            continue
        if o.action == SELL:
            market.admin_reserve_shares = max(0, market.admin_reserve_shares - qty)
        elif o.action == BUY:
            # Automated buy fills are swept into the tracked admin reserve.
            buyer = position(db, o.user_id, market.id, "YES")
            treasury = position(db, "ADMIN", market.id, "YES")
            moved_cost = buyer.cost_basis_cents * qty // buyer.quantity if buyer.quantity else 0
            buyer.quantity -= qty
            buyer.cost_basis_cents -= moved_cost
            treasury.quantity += qty
            treasury.cost_basis_cents += moved_cost
            market.admin_reserve_shares += qty

    if ttype == "MINT":
        entries.append((ledger.collateral_account(market.id), 100 * qty))
        market.minted_pairs += qty
        market.collateral_cents += 100 * qty
    elif ttype == "BURN":
        entries.append((ledger.collateral_account(market.id), -100 * qty))
        market.minted_pairs -= qty
        market.collateral_cents -= 100 * qty

    ledger.post(db, entries, ttype, ref_trade_id=trade.id, now=now)
    market.last_price_cents = price
    market.volume += qty
    return trade


def _release(db: Session, order: Order) -> None:
    if order.remaining == 0:
        return
    if order.action == BUY:
        ledger.release_cash(db, order.user_id, order.price_cents * order.remaining)
    else:
        position(db, order.user_id, order.market_id, order.contract).reserved_qty -= order.remaining


def cancel_order(db: Session, user_id: str, order_id: int) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise DomainError("Order not found", 404)
    user = db.get(User, user_id)
    if order.user_id != user_id and (user is None or user.role != "ADMIN"):
        raise DomainError("You can only cancel your own orders", 403)
    if order.status not in OPEN_STATUSES:
        raise DomainError(f"Cannot cancel an order that is {order.status}")
    _release(db, order)
    _return_admin_backed_inventory(db, order)
    order.status = "CANCELLED"
    db.commit()
    return order


def cancel_all_open(db: Session, market_id: str) -> int:
    """Cancel every resting order in a market. Caller commits."""
    orders = db.scalars(select(Order).where(Order.market_id == market_id,
                                            Order.status.in_(OPEN_STATUSES))).all()
    for o in orders:
        _release(db, o)
        _return_admin_backed_inventory(db, o)
        o.status = "CANCELLED"
    return len(orders)


def _return_admin_backed_inventory(db: Session, order: Order) -> None:
    if not order.admin_backed or order.action != SELL or order.remaining <= 0:
        return
    issuer = position(db, order.user_id, order.market_id, "YES")
    treasury = position(db, "ADMIN", order.market_id, "YES")
    qty = order.remaining
    moved_cost = issuer.cost_basis_cents * qty // issuer.quantity if issuer.quantity else 0
    issuer.quantity -= qty
    issuer.cost_basis_cents -= moved_cost
    treasury.quantity += qty
    treasury.cost_basis_cents += moved_cost
