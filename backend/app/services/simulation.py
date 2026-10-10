"""Live trading simulation for Students A–E, with each trade recorded in Capital One Nessie.

While running, bots act every few seconds on one of the A–E markets: mostly they take the
best quote (a real trade through the matching engine), sometimes they post a new resting
quote near the last price so the book never runs dry. A slowly wandering per-market bias
makes prices trend instead of just jittering. Each trade's cash leg is queued as a Nessie
transfer from the buyer's account (whole dollars; this Nessie server keeps balances fixed,
so our ledger stays the source of truth).
"""
import asyncio
import random
import time
from collections import deque
from datetime import datetime, timezone

from sqlalchemy import select

from ..db import DomainError, SessionLocal, utcnow
from ..models import Market, Order, Student, User
from ..realtime.ws_manager import manager
from . import ledger_service as ledger
from . import market_service, nessie, order_service
from .matching_engine import BUY, LIMIT, SELL, YES

STUDENT_IDS = ("STU001", "STU002", "STU003", "STU004", "STU005")
# Trader A is left alone so a person can trade by hand during the demo.
BOTS = ("TRADER_B", "TRADER_C", "MM_ALPHA", "MM_BETA")
TICK = (1.5, 4.0)  # seconds between bot actions


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat().replace("+00:00", "Z")


class Simulation:
    def __init__(self):
        self.task: asyncio.Task | None = None
        self.worker: asyncio.Task | None = None
        self._reset(0, False)

    def _reset(self, minutes, use_nessie):
        self.minutes = minutes
        self.started_at = self.ends_at = None
        self.trades = self.volume_cents = self.quotes = 0
        self.events: deque[dict] = deque(maxlen=40)
        self.start_prices: dict[str, int | None] = {}
        self.bias: dict[str, float] = {}
        self.nessie = {"enabled": use_nessie, "ok": 0, "failed": 0, "queued": 0, "error": None}
        self.queue: asyncio.Queue | None = None
        self.client: nessie.Nessie | None = None
        self.accounts: dict[str, str] = {}

    @property
    def running(self) -> bool:
        return self.task is not None and not self.task.done()

    async def start(self, minutes: int, use_nessie: bool):
        if self.running:
            raise DomainError("A simulation is already running")
        self._reset(minutes, use_nessie)
        with SessionLocal() as db:
            markets = _markets(db)
            if not markets:
                raise DomainError("Students A–E have no trading markets")
            self.start_prices = {m.id: m.last_price_cents for m in markets}
            if use_nessie:
                await self._setup_nessie(db)
        self.started_at = time.time()
        self.ends_at = self.started_at + minutes * 60
        self.task = asyncio.create_task(self._run())

    async def stop(self):
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        self.ends_at = min(self.ends_at or time.time(), time.time())

    async def _setup_nessie(self, db):
        try:
            self.client = nessie.Nessie()
            # Trader A does not trade automatically but can be on either side of a bot's trade.
            people = list(BOTS) + ["TRADER_A"]
            balances = {u: ledger.wallet(db, u).available_cents // 100 for u in people}
            self.accounts = await nessie.ensure_accounts(db, self.client, people, balances)
            self.queue = asyncio.Queue()
            self.worker = asyncio.create_task(self._nessie_worker())
        except Exception as e:  # keep trading even if Nessie is unavailable
            self.nessie.update(enabled=False, error=str(e)[:200])

    async def _run(self):
        rng = random.Random()
        try:
            while time.time() < self.ends_at:
                await asyncio.sleep(rng.uniform(*TICK))
                try:
                    await self._tick(rng)
                except DomainError:
                    pass  # e.g. a quote that would self-trade; just try again next tick
        finally:
            if self.worker:
                # Give queued Nessie transfers a moment to finish, then stop the worker.
                for _ in range(20):
                    if not self.queue or self.queue.empty():
                        break
                    await asyncio.sleep(0.5)
                self.worker.cancel()
            if self.client:
                await self.client.close()

    async def _tick(self, rng):
        with SessionLocal() as db:
            market = rng.choice(_markets(db))
            bias = self.bias.get(market.id, 0.0) * 0.9 + rng.gauss(0, 0.35)
            self.bias[market.id] = max(-1.0, min(1.0, bias))
            last = market.last_price_cents or market.initial_price_cents or market.share_value_cents // 2
            if rng.random() < 0.3:
                self._quote(db, rng, market, last)
                db.commit()
                await manager.broadcast("ORDERBOOK_UPDATED", market.id)
                return
            buying = rng.random() < 0.5 + 0.25 * self.bias[market.id]
            bid, ask = market_service.best_prices(db, market.id)
            target = ask if buying else bid
            if target is None:
                self._quote(db, rng, market, last)
                db.commit()
                return
            actors = [u for u in BOTS if self._can(db, market, u, buying, target)]
            rng.shuffle(actors)
            for actor in actors:
                try:
                    order, trades = order_service.place_order(db, actor, market.id, YES, BUY if buying else SELL,
                                                              LIMIT, target, rng.choice([1, 1, 2, 3]))
                except DomainError:
                    continue
                if trades:
                    await self._record(db, market, trades)
                return

    def _can(self, db, market, user, buying, price) -> bool:
        if buying:
            return ledger.wallet(db, user).available_cents >= price * 3
        pos = order_service.position(db, user, market.id, YES)
        return pos.quantity - pos.reserved_qty > 0

    def _quote(self, db, rng, market, last):
        """A bot rests a new order a little away from the last price."""
        user = rng.choice(BOTS)
        pos = order_service.position(db, user, market.id, YES)
        selling = pos.quantity - pos.reserved_qty > 0 and rng.random() < 0.5
        move = rng.uniform(0.003, 0.025)
        price = round(last * (1 + move if selling else 1 - move))
        price = max(1, min(market.share_value_cents - 1, price))
        qty = min(rng.randint(1, 3), pos.quantity - pos.reserved_qty) if selling else rng.randint(1, 3)
        if qty <= 0 or (not selling and ledger.wallet(db, user).available_cents < price * qty):
            return
        try:
            order_service._place(db, user, market.id, YES, SELL if selling else BUY, LIMIT, price, qty, utcnow())
            self.quotes += 1
        except DomainError:
            db.rollback()

    async def _record(self, db, market, trades):
        student = db.get(Student, market.student_id)
        name = db.get(User, student.user_id).display_name
        for t in trades:
            maker, taker = db.get(Order, t.maker_order_id), db.get(Order, t.taker_order_id)
            buyer, seller = (taker, maker) if taker.action == BUY else (maker, taker)
            amount = t.yes_price_cents * t.quantity
            self.trades += 1
            self.volume_cents += amount
            event = {"id": t.id, "time": _iso(time.time()), "market_id": market.id, "student": name,
                     "buyer": buyer.user_id, "seller": seller.user_id, "quantity": t.quantity,
                     "price_cents": t.yes_price_cents, "amount_cents": amount, "nessie": "off"}
            if self.queue and buyer.user_id in self.accounts and seller.user_id in self.accounts:
                event["nessie"] = "queued"
                self.nessie["queued"] += 1
                self.queue.put_nowait(event)
            self.events.appendleft(event)
            await manager.broadcast("TRADE_EXECUTED", market.id, {
                "quantity": t.quantity, "yes_price": t.yes_price_cents, "trade_type": t.trade_type})
        await manager.broadcast("ORDERBOOK_UPDATED", market.id)

    async def _nessie_worker(self):
        while True:
            event = await self.queue.get()
            try:
                description = (f"SPE: {event['buyer']} bought {event['quantity']} {event['student']} share(s) "
                               f"@ ${event['price_cents'] / 100:,.2f} from {event['seller']}")
                transfer_id = await self.client.transfer(self.accounts[event["buyer"]], self.accounts[event["seller"]],
                                                         event["amount_cents"] / 100, description)
                event["nessie"] = transfer_id
                self.nessie["ok"] += 1
            except Exception as e:
                event["nessie"] = "failed"
                self.nessie["failed"] += 1
                self.nessie["error"] = str(e)[:200]
            finally:
                self.nessie["queued"] -= 1

    def status(self) -> dict:
        now = time.time()
        with SessionLocal() as db:
            prices = []
            for m in _markets(db):
                student = db.get(Student, m.student_id)
                prices.append({"market_id": m.id, "student": db.get(User, student.user_id).display_name,
                               "price_cents": m.last_price_cents, "start_cents": self.start_prices.get(m.id),
                               "share_value_cents": m.share_value_cents})
        return {
            "running": self.running,
            "minutes": self.minutes,
            "started_at": _iso(self.started_at) if self.started_at else None,
            "remaining_seconds": max(0, int(self.ends_at - now)) if self.running else 0,
            "trades": self.trades,
            "quotes": self.quotes,
            "volume_cents": self.volume_cents,
            "nessie": {**self.nessie, "configured": nessie.configured()},
            "markets": prices,
            "events": list(self.events)[:25],
        }


def _markets(db):
    return db.scalars(select(Market).where(Market.student_id.in_(STUDENT_IDS), Market.status == "TRADING",
                                           Market.probability_bp.is_not(None)).order_by(Market.id)).all()


simulation = Simulation()
