"""Capital One Nessie (mock banking) client.

Each simulation participant gets a Nessie customer with one checking account. A trade's
cash leg is mirrored as a Nessie transfer from the buyer's account to the seller's.
Account ids are stored in `nessie_accounts` so they are created only once per key.
"""
import os
from datetime import date
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import NessieAccount, User

ENV_FILE = Path(__file__).resolve().parents[3] / ".env"
TIMEOUT = httpx.Timeout(10.0)


def _env(name: str) -> str | None:
    if os.getenv(name):
        return os.environ[name]
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            key, sep, value = line.partition("=")
            if sep and key.strip() == name:
                return value.strip().strip('"').strip("'")
    return None


def configured() -> bool:
    return bool(_env("NESSIE_API_KEY") and _env("NESSIE_BASE_URL"))


class NessieError(Exception):
    pass


class Nessie:
    def __init__(self):
        if not configured():
            raise NessieError("NESSIE_API_KEY and NESSIE_BASE_URL must be set in .env")
        self.base = _env("NESSIE_BASE_URL").rstrip("/")
        self.key = _env("NESSIE_API_KEY")
        self.client = httpx.AsyncClient(timeout=TIMEOUT)

    async def close(self):
        await self.client.aclose()

    async def _call(self, method: str, path: str, json: dict | None = None, params: dict | None = None):
        try:
            r = await self.client.request(method, f"{self.base}{path}", params={"key": self.key, **(params or {})},
                                          json=json)
        except httpx.HTTPError as e:
            raise NessieError(f"Nessie unreachable: {type(e).__name__}") from e
        if r.status_code >= 400:
            raise NessieError(f"Nessie {method} {path.split('?')[0]} → {r.status_code}: {r.text[:160]}")
        return r.json() if r.content else None

    async def create_customer(self, first: str, last: str) -> str:
        body = {"first_name": first, "last_name": last, "address": {
            "street_number": "100", "street_name": "Franklin St", "city": "Chapel Hill", "state": "NC", "zip": "27514"}}
        return (await self._call("POST", "/customers", body))["objectCreated"]["_id"]

    async def create_account(self, customer_id: str, nickname: str, balance_dollars: int) -> str:
        body = {"type": "Checking", "nickname": nickname[:30], "rewards": 0, "balance": max(0, int(balance_dollars))}
        return (await self._call("POST", f"/customers/{customer_id}/accounts", body))["objectCreated"]["_id"]

    async def account(self, account_id: str) -> dict:
        return await self._call("GET", f"/accounts/{account_id}")

    async def transfer(self, payer_account: str, payee_account: str, amount_dollars: float, description: str) -> str:
        # This Nessie deployment takes the payee as a query parameter, requires a date and status,
        # and stores whole-dollar amounts.
        body = {"transaction_date": date.today().isoformat(), "status": "completed",
                "amount": round(amount_dollars), "description": description[:140]}
        created = await self._call("POST", f"/accounts/{payer_account}/transfers", body, {"payee_id": payee_account})
        return created["objectCreated"]["_id"]


async def ensure_accounts(db: Session, nessie: Nessie, user_ids: list[str], balances: dict[str, int]) -> dict[str, str]:
    """Return user_id -> Nessie account id, creating customers/accounts that do not exist yet."""
    out = {}
    for uid in user_ids:
        row = db.get(NessieAccount, uid)
        if row is None:
            name = db.get(User, uid).display_name
            first, _, last = f"SPE {name}".partition(" ")
            customer = await nessie.create_customer(first, last or "Trader")
            account = await nessie.create_account(customer, f"SPE {name}", balances.get(uid, 0))
            row = NessieAccount(user_id=uid, customer_id=customer, account_id=account)
            db.add(row)
            db.commit()
        out[uid] = row.account_id
    return out


def stored_accounts(db: Session) -> dict[str, str]:
    return {r.user_id: r.account_id for r in db.scalars(select(NessieAccount)).all()}
