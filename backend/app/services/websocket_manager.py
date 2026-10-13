import json
import logging
import uuid
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger("proxyproof.websocket")


class ConnectionManager:
    def __init__(self):
        # session_id -> Set[WebSocket]
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        self.active_connections[session_id].add(websocket)
        logger.info("WebSocket connected for session %s (total: %d)", session_id, len(self.active_connections[session_id]))

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        logger.info("WebSocket disconnected for session %s", session_id)

    async def broadcast_session_event(self, session_id: uuid.UUID, event_type: str, data: dict):
        key = str(session_id)
        if key not in self.active_connections:
            return

        payload = json.dumps({"event": event_type, "data": data}, default=str)
        dead_sockets = set()

        for connection in list(self.active_connections[key]):
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning("Error sending WebSocket message: %s", e)
                dead_sockets.add(connection)

        for dead in dead_sockets:
            self.disconnect(key, dead)


ws_manager = ConnectionManager()
