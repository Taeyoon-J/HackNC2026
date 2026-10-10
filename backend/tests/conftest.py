import os
import tempfile

import pytest

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["SPE_DATABASE_URL"] = f"sqlite:///{_tmp.name}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import reset_and_seed  # noqa: E402

M1 = "STU001-GPA-2026F"


@pytest.fixture
def client():
    reset_and_seed()
    with TestClient(app) as c:
        yield c


def as_user(client, user_id):
    def call(method, url, **kw):
        r = client.request(method, url, headers={"X-User-Id": user_id}, **kw)
        return r
    return call


def order(client, user, contract, action, price, qty, market=M1, order_type="LIMIT"):
    return as_user(client, user)("POST", "/api/orders", json={
        "market_id": market, "contract": contract, "action": action, "order_type": order_type,
        "price_cents": price, "quantity": qty})


def assert_invariants(client):
    checks = as_user(client, "ADMIN")("GET", "/api/admin/invariants").json()
    failed = [c for c in checks if not c["ok"]]
    assert not failed, failed
