import hmac
import hashlib
import struct
import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from backend.app.db.seed import DEFAULT_DEV_PASSWORD


def get_token(client: TestClient, email: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": DEFAULT_DEV_PASSWORD},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def derive_proof(session_secret_hex: str, session_id: uuid.UUID, slot: int, version: int = 1) -> str:
    secret_bytes = bytes.fromhex(session_secret_hex)
    msg = struct.pack(">B", version) + session_id.bytes + struct.pack(">I", slot)
    return hmac.new(secret_bytes, msg, hashlib.sha256).hexdigest()[:32]


def test_session_lifecycle_and_attendance_validation(client: TestClient):
    token_org = get_token(client, "organizer@proxyproof.local")
    token_s1 = get_token(client, "student1@proxyproof.local")
    token_s2 = get_token(client, "student2@proxyproof.local")
    token_s3 = get_token(client, "student3@proxyproof.local")

    # 1. Organizer gets their class
    res_cls = client.get("/api/v1/classes", headers={"Authorization": f"Bearer {token_org}"})
    assert res_cls.status_code == 200
    class_id = res_cls.json()[0]["id"]

    # 2. Organizer starts session
    res_start = client.post(
        f"/api/v1/classes/{class_id}/sessions",
        json={"duration_minutes": 10, "notes": "Midterm Review", "proximity_threshold": -75},
        headers={"Authorization": f"Bearer {token_org}"},
    )
    assert res_start.status_code == 201
    session_data = res_start.json()
    session_id = uuid.UUID(session_data["id"])
    secret_hex = session_data["session_secret"]
    assert len(secret_hex) == 64  # 32 bytes hex
    assert session_data["status"] == "active"

    # 3. Student 1 (enrolled) views active session
    res_s1_active = client.get("/api/v1/sessions/active", headers={"Authorization": f"Bearer {token_s1}"})
    assert res_s1_active.status_code == 200
    active_sessions = res_s1_active.json()
    assert any(s["id"] == str(session_id) for s in active_sessions)
    # Ensure session secret is NOT leaked to student
    assert "session_secret" not in active_sessions[0]

    # Student 3 (not enrolled) does NOT see active session
    res_s3_active = client.get("/api/v1/sessions/active", headers={"Authorization": f"Bearer {token_s3}"})
    assert res_s3_active.status_code == 200
    assert not any(s["id"] == str(session_id) for s in res_s3_active.json())

    # 4. Successful attendance marking for Student 1
    current_slot = int(datetime.now(timezone.utc).timestamp() // 5)
    valid_proof = derive_proof(secret_hex, session_id, current_slot)

    req_id_1 = str(uuid.uuid4())
    res_attempt = client.post(
        f"/api/v1/sessions/{session_id}/attendance-attempts",
        json={
            "proof": valid_proof,
            "time_slot": current_slot,
            "request_id": req_id_1,
            "rssi_median": -68,
            "rssi_samples": [-70, -68, -66],
        },
        headers={"Authorization": f"Bearer {token_s1}"},
    )
    assert res_attempt.status_code == 200
    data_att = res_attempt.json()
    assert data_att["outcome_code"] == "SUCCESS"
    assert data_att["status"] == "present"

    # 5. Idempotent retry with same request_id
    res_retry_same = client.post(
        f"/api/v1/sessions/{session_id}/attendance-attempts",
        json={
            "proof": valid_proof,
            "time_slot": current_slot,
            "request_id": req_id_1,
            "rssi_median": -68,
        },
        headers={"Authorization": f"Bearer {token_s1}"},
    )
    assert res_retry_same.status_code == 200
    assert res_retry_same.json()["outcome_code"] == "SUCCESS"

    # 6. Idempotent retry with new request_id -> ALREADY_MARKED
    req_id_2 = str(uuid.uuid4())
    res_retry_new = client.post(
        f"/api/v1/sessions/{session_id}/attendance-attempts",
        json={
            "proof": valid_proof,
            "time_slot": current_slot,
            "request_id": req_id_2,
            "rssi_median": -65,
        },
        headers={"Authorization": f"Bearer {token_s1}"},
    )
    assert res_retry_new.status_code == 200
    assert res_retry_new.json()["outcome_code"] == "ALREADY_MARKED"

    # 7. Stale token rejection
    stale_slot = current_slot - 5
    stale_proof = derive_proof(secret_hex, session_id, stale_slot)
    res_stale = client.post(
        f"/api/v1/sessions/{session_id}/attendance-attempts",
        json={
            "proof": stale_proof,
            "time_slot": stale_slot,
            "request_id": str(uuid.uuid4()),
            "rssi_median": -65,
        },
        headers={"Authorization": f"Bearer {token_s2}"},
    )
    assert res_stale.status_code == 400
    assert res_stale.json()["detail"]["outcome_code"] == "STALE_PROOF"

    # 8. Future token rejection
    future_slot = current_slot + 5
    future_proof = derive_proof(secret_hex, session_id, future_slot)
    res_future = client.post(
        f"/api/v1/sessions/{session_id}/attendance-attempts",
        json={
            "proof": future_proof,
            "time_slot": future_slot,
            "request_id": str(uuid.uuid4()),
            "rssi_median": -65,
        },
        headers={"Authorization": f"Bearer {token_s2}"},
    )
    assert res_future.status_code == 400
    assert res_future.json()["detail"]["outcome_code"] == "FUTURE_PROOF"

    # 9. Invalid token rejection
    res_invalid = client.post(
        f"/api/v1/sessions/{session_id}/attendance-attempts",
        json={
            "proof": "0" * 32,
            "time_slot": current_slot,
            "request_id": str(uuid.uuid4()),
            "rssi_median": -65,
        },
        headers={"Authorization": f"Bearer {token_s2}"},
    )
    assert res_invalid.status_code == 400
    assert res_invalid.json()["detail"]["outcome_code"] == "INVALID_PROOF"

    # 10. Proximity threshold failure (below -75 dBm)
    res_low_rssi = client.post(
        f"/api/v1/sessions/{session_id}/attendance-attempts",
        json={
            "proof": valid_proof,
            "time_slot": current_slot,
            "request_id": str(uuid.uuid4()),
            "rssi_median": -85,
        },
        headers={"Authorization": f"Bearer {token_s2}"},
    )
    assert res_low_rssi.status_code == 400
    assert res_low_rssi.json()["detail"]["outcome_code"] == "BELOW_PROXIMITY_THRESHOLD"

    # 11. Unenrolled student rejection
    res_unenrolled = client.post(
        f"/api/v1/sessions/{session_id}/attendance-attempts",
        json={
            "proof": valid_proof,
            "time_slot": current_slot,
            "request_id": str(uuid.uuid4()),
            "rssi_median": -65,
        },
        headers={"Authorization": f"Bearer {token_s3}"},
    )
    assert res_unenrolled.status_code == 400
    assert res_unenrolled.json()["detail"]["outcome_code"] == "NOT_ENROLLED"

    # 12. Manual mark by organizer for Student 2
    student2_id = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_s2}"}).json()["id"]
    res_manual = client.post(
        f"/api/v1/sessions/{session_id}/attendance/manual",
        json={
            "student_id": student2_id,
            "action": "manual_present",
            "reason": "BLE antenna issue on phone; physically present in row 2",
        },
        headers={"Authorization": f"Bearer {token_org}"},
    )
    assert res_manual.status_code == 201
    assert res_manual.json()["status"] == "manual_present"

    # 13. Organizer closes session early
    res_close = client.post(
        f"/api/v1/sessions/{session_id}/close",
        headers={"Authorization": f"Bearer {token_org}"},
    )
    assert res_close.status_code == 200
    assert res_close.json()["status"] == "closed"

    # 14. Further marks on closed session must be rejected
    res_closed_attempt = client.post(
        f"/api/v1/sessions/{session_id}/attendance-attempts",
        json={
            "proof": valid_proof,
            "time_slot": current_slot,
            "request_id": str(uuid.uuid4()),
            "rssi_median": -65,
        },
        headers={"Authorization": f"Bearer {token_s2}"},
    )
    assert res_closed_attempt.status_code == 400
    assert "CLOSED" in res_closed_attempt.json()["detail"]["outcome_code"]

    # 15. Student attendance summary and history
    res_summary = client.get(
        "/api/v1/students/me/attendance-summary",
        headers={"Authorization": f"Bearer {token_s1}"},
    )
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert len(summary) >= 1
    assert summary[0]["attended_sessions"] >= 1
    assert summary[0]["percentage"] > 0

    res_history = client.get(
        "/api/v1/students/me/attendance-history",
        headers={"Authorization": f"Bearer {token_s1}"},
    )
    assert res_history.status_code == 200
    history = res_history.json()
    assert len(history) >= 1
    assert history[0]["status"] in ("present", "manual_present")

    # 16. CSV Export
    res_csv = client.get(
        f"/api/v1/sessions/{session_id}/export.csv",
        headers={"Authorization": f"Bearer {token_org}"},
    )
    assert res_csv.status_code == 200
    assert res_csv.headers["content-type"] == "text/csv; charset=utf-8"
    assert "Alice Smith" in res_csv.text
    assert "present" in res_csv.text


def test_csv_formula_sanitization_unit():
    """Verifies that malicious spreadsheet formulas are sanitized with single quote escaping."""
    from backend.app.services.export_service import sanitize_csv_cell, generate_attendance_csv

    assert sanitize_csv_cell("=cmd|' /C calc'!A0") == "'=cmd|' /C calc'!A0"
    assert sanitize_csv_cell("+12345") == "'+12345"
    assert sanitize_csv_cell("-12345") == "'-12345"
    assert sanitize_csv_cell("@SUM(A1:A10)") == "'@SUM(A1:A10)"
    assert sanitize_csv_cell("Normal Student Name") == "Normal Student Name"

    # Test complete CSV output
    malicious_record = [{
        "session_id": str(uuid.uuid4()),
        "student_id": str(uuid.uuid4()),
        "student_name": "=DDE('cmd';'/C calc';'A0')",
        "student_number": "@SUM(1+1)",
        "student_email": "+hacker@example.com",
        "status": "present",
        "source": "ble",
        "marked_at": "2026-10-13T10:00:00Z",
        "reason": "-malicious_payload",
    }]
    csv_output = generate_attendance_csv(malicious_record, "=MaliciousClass", "+CODE")
    assert "'=DDE" in csv_output
    assert "'@SUM" in csv_output
    assert "'+hacker" in csv_output
    assert "'-malicious" in csv_output

