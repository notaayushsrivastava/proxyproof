import uuid
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from backend.app.db.session import SessionLocal
from backend.app.core.security import decode_token
from backend.app.models import User, AttendanceSession
from backend.app.models.enums import UserRole
from backend.app.services.websocket_manager import ws_manager

logger = logging.getLogger("proxyproof.ws_endpoint")
router = APIRouter()


@router.websocket("/ws/sessions/{session_id}")
async def websocket_session_endpoint(
    websocket: WebSocket,
    session_id: uuid.UUID,
    token: str = Query(...),
):
    """
    Authenticated WebSocket endpoint for real-time session attendance updates.
    Verifies token, organizer assignment, and session access before accepting.
    """
    db: Session = SessionLocal()
    try:
        payload = decode_token(token)
        user_id_str = payload.get("sub")
        role = payload.get("role")
        if not user_id_str or role not in ("organizer", "admin"):
            await websocket.close(code=4003, reason="Unauthorized role")
            return

        user_id = uuid.UUID(user_id_str)
        sess = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not sess:
            await websocket.close(code=4004, reason="Session not found")
            return

        if role != "admin" and sess.organizer_id != user_id:
            await websocket.close(code=4003, reason="Forbidden")
            return

        await ws_manager.connect(str(session_id), websocket)
        try:
            while True:
                # Keepalive / ping listener
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
        except WebSocketDisconnect:
            ws_manager.disconnect(str(session_id), websocket)
    except Exception as e:
        logger.warning("WebSocket connection failed: %s", e)
        await websocket.close(code=4001, reason="Authentication failed")
    finally:
        db.close()
