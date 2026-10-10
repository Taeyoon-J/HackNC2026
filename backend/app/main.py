from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import admin, markets, me, orders, portfolio, students
from .db import Base, DomainError, engine
from .realtime.ws_manager import ALL, manager

@asynccontextmanager
async def lifespan(_: FastAPI):
    from .seed import is_seeded, reset_and_seed
    Base.metadata.create_all(engine)
    if not is_seeded():
        reset_and_seed()
    yield


app = FastAPI(title="Student Performance Exchange", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

for module in (markets, orders, portfolio, students, me, admin):
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
