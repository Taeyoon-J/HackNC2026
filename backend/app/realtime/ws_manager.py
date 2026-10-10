from collections import defaultdict

from fastapi import WebSocket

ALL = "*"


class WSManager:
    """Market-scoped rooms. Clients on the "*" channel receive every market's events."""

    def __init__(self):
        self.rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, ws: WebSocket, channel: str) -> None:
        await ws.accept()
        self.rooms[channel].add(ws)

    def disconnect(self, ws: WebSocket, channel: str) -> None:
        self.rooms[channel].discard(ws)

    async def broadcast(self, event_type: str, market_id: str, data: dict | None = None) -> None:
        message = {"type": event_type, "market_id": market_id, "data": data or {}}
        for channel in (market_id, ALL):
            for ws in list(self.rooms[channel]):
                try:
                    await ws.send_json(message)
                except Exception:
                    self.rooms[channel].discard(ws)


manager = WSManager()
