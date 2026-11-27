"""Administrador de suscripciones SSE y WebSocket para el tablero en vivo."""

from __future__ import annotations

import asyncio
import json
from typing import Any


class RealtimeBroadcaster:
    """Publica eventos de métricas, alertas y planes hacia clientes conectados."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str]] = set()

    def subscribe(self) -> asyncio.Queue[str]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=25)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[str]) -> None:
        self._subscribers.discard(queue)

    async def broadcast(self, event_type: str, payload: dict[str, Any]) -> None:
        if not self._subscribers:
            return
        message = json.dumps({"type": event_type, **payload}, ensure_ascii=False)
        stale: list[asyncio.Queue[str]] = []
        for q in list(self._subscribers):
            if q.full():
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                stale.append(q)
        for q in stale:
            self._subscribers.discard(q)


broadcaster = RealtimeBroadcaster()
