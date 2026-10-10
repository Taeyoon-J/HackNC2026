from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import account, admin, favorites, markets, me, orders, portfolio, students, verifications
from .db import Base, DomainError, engine
from .realtime.ws_manager import ALL, manager

@asynccontextmanager
async def lifespan(_: FastAPI):
    from .seed import is_seeded, reset_and_seed
    from .schema import ensure_schema
    ensure_schema()
    if not is_seeded():
        reset_and_seed()
    task = asyncio.create_task(_liquidity_scheduler())
    try:
        yield
    finally:
        from .services.simulation import simulation
        await simulation.stop()
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


async def _liquidity_scheduler():
    from .db import SessionLocal
    from .services.fixed_market_service import run_stale_market_liquidity
    while True:
        await asyncio.sleep(60)
        db = SessionLocal()
        try:
            run_stale_market_liquidity(db)
        except Exception:
            db.rollback()
            logging.getLogger(__name__).exception("Automatic stale-market liquidity update failed")
        finally:
            db.close()


app = FastAPI(title="Student Performance Exchange", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

for module in (markets, orders, portfolio, students, me, admin, account, favorites, verifications):
    app.include_router(module.router)


@app.exception_handler(DomainError)
async def domain_error_handler(_, exc: DomainError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.websocket("/ws")
async def websocket(ws: WebSocket, market_id: str = ALL):
    await manager.connect(ws, market_id)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws, market_id)
