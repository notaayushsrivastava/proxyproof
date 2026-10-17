import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.db.seed import DEFAULT_DEV_PASSWORD


def get_token(client: TestClient, email: str, password: str = DEFAULT_DEV_PASSWORD) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_auth_login_roles(client: TestClient):
    """Verifies that student, organizer, and admin can login and receive valid roles."""
    # 1. Admin login
    res_admin = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@university.local", "password": "AdminPass123!"},
    )
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert data_admin["user"]["role"] == "admin"
    assert "access_token" in data_admin

    # 2. Organizer login
    res_org = client.post(
        "/api/v1/auth/login",
        json={"email": "smith@university.local", "password": "ProfPass123!"},
    )
    assert res_org.status_code == 200
    assert res_org.json()["user"]["role"] == "organizer"

    # 3. Student login
    res_student = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@university.local", "password": "StudentPass123!"},
    )
    assert res_student.status_code == 200
    data_student = res_student.json()
    assert data_student["user"]["role"] == "student"
    assert data_student["user"]["student_profile"]["student_number"] == "2026-CS-001"


def test_auth_invalid_credentials(client: TestClient):
    """Verifies rejection of invalid password."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@university.local", "password": "WrongPassword!"},
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_get_current_user_profile(client: TestClient):
    """Verifies /api/v1/auth/me returns the authenticated profile."""
    token = get_token(client, "alice@university.local", "StudentPass123!")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "alice@university.local"


def test_device_registration_and_change_approval_flow(client: TestClient, db_session: Session):
    """
    Comprehensive test of device registration policy and admin approval queue:
    1. Fresh Student (no active device initially) registers device -> auto-activated.
    2. Fresh Student registers a 2nd device -> registered as PENDING.
    3. Fresh Student files device change request.
    4. Admin approves request -> new device ACTIVE, old device REVOKED.
    """
    from backend.app.models.user import User
    from backend.app.models.enums import UserRole, AccountStatus
    from backend.app.core.security import hash_password

    # Find the seeded university institution so fresh student belongs to it
    admin_user = db_session.query(User).filter(User.email == "admin@university.local").first()

    unique_email = f"device_flow_{uuid.uuid4().hex[:6]}@university.local"
    fresh_student = User(
        id=uuid.uuid4(),
        email=unique_email,
        password_hash=hash_password(DEFAULT_DEV_PASSWORD),
        role=UserRole.STUDENT,
        full_name="Device Flow Student",
        institution_id=admin_user.institution_id if admin_user else None,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(fresh_student)
    db_session.commit()

    token_student3 = get_token(client, unique_email)
    token_admin = get_token(client, "admin@university.local", "AdminPass123!")

    # 1. First device -> should be auto-activated
    res_dev1 = client.post(
        "/api/v1/devices/register",
        json={
            "platform": "android",
            "device_label": "Pixel 9 Pro",
            "public_key": "key1_example_public_bytes",
        },
        headers={"Authorization": f"Bearer {token_student3}"},
    )
    assert res_dev1.status_code == 201
    dev1 = res_dev1.json()
    assert dev1["status"] == "active"

    # 2. Second device -> must be registered as PENDING
    res_dev2 = client.post(
        "/api/v1/devices/register",
        json={
            "platform": "ios",
            "device_label": "iPhone 16",
            "public_key": "key2_example_public_bytes",
        },
        headers={"Authorization": f"Bearer {token_student3}"},
    )
    assert res_dev2.status_code == 201
    dev2 = res_dev2.json()
    assert dev2["status"] == "pending"

    # 3. Student files change request
    res_req = client.post(
        "/api/v1/devices/change-requests",
        json={
            "new_device_id": dev2["id"],
            "reason": "Switched to iOS for mobile testing",
        },
        headers={"Authorization": f"Bearer {token_student3}"},
    )
    assert res_req.status_code == 201
    req_data = res_req.json()
    assert req_data["status"] == "pending"
    request_id = req_data["id"]

    # 4. Admin lists pending requests
    res_admin_list = client.get(
        "/api/v1/admin/device-change-requests",
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert res_admin_list.status_code == 200
    pending_ids = [r["id"] for r in res_admin_list.json()]
    assert request_id in pending_ids

    # 5. Admin approves request
    res_approve = client.post(
        f"/api/v1/admin/device-change-requests/{request_id}/approve",
        json={"reason": "Verified with student in person"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["status"] == "approved"

    # 6. Verify devices state: dev1 is now REVOKED, dev2 is now ACTIVE
    res_devices = client.get(
        "/api/v1/devices/me",
        headers={"Authorization": f"Bearer {token_student3}"},
    )
    devices_map = {d["id"]: d["status"] for d in res_devices.json()}
    assert devices_map[dev1["id"]] == "revoked"
    assert devices_map[dev2["id"]] == "active"


def test_classes_and_roster_permissions(client: TestClient):
    """
    Verifies class visibility scoping and roster modification permissions:
    1. Organizer sees their classes.
    2. Student sees only enrolled classes.
    3. Student cannot add members to roster (403 Forbidden).
    4. Organizer can add Bob to CS401-2026, then remove them.
    """
    token_org = get_token(client, "smith@university.local", "ProfPass123!")
    token_student1 = get_token(client, "alice@university.local", "StudentPass123!")
    token_student2 = get_token(client, "bob@university.local", "StudentPass123!")

    # Organizer lists classes
    res_org_classes = client.get(
        "/api/v1/classes",
        headers={"Authorization": f"Bearer {token_org}"},
    )
    assert res_org_classes.status_code == 200
    classes = res_org_classes.json()
    assert len(classes) >= 1
    class_id = classes[0]["id"]

    # Student 1 (Alice, enrolled) lists classes -> sees class
    res_s1_classes = client.get(
        "/api/v1/classes",
        headers={"Authorization": f"Bearer {token_student1}"},
    )
    assert res_s1_classes.status_code == 200
    assert any(c["id"] == class_id for c in res_s1_classes.json())

    # Student 2 (Bob, not yet enrolled) lists classes -> does NOT see this class
    res_s2_classes = client.get(
        "/api/v1/classes",
        headers={"Authorization": f"Bearer {token_student2}"},
    )
    assert res_s2_classes.status_code == 200
    assert not any(c["id"] == class_id for c in res_s2_classes.json())

    # Student cannot view or modify roster
    res_unauth = client.get(
        f"/api/v1/classes/{class_id}/roster",
        headers={"Authorization": f"Bearer {token_student1}"},
    )
    assert res_unauth.status_code == 403

    # Organizer views roster
    res_roster = client.get(
        f"/api/v1/classes/{class_id}/roster",
        headers={"Authorization": f"Bearer {token_org}"},
    )
    assert res_roster.status_code == 200
    initial_count = len(res_roster.json())

    # Get Bob's id
    bob_profile = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token_student2}"},
    ).json()
    bob_id = bob_profile["id"]

    # Organizer enrolls Bob
    res_add = client.post(
        f"/api/v1/classes/{class_id}/members",
        json={"student_id": bob_id},
        headers={"Authorization": f"Bearer {token_org}"},
    )
    assert res_add.status_code == 201

    # Organizer removes Bob
    res_remove = client.delete(
        f"/api/v1/classes/{class_id}/members/{bob_id}",
        headers={"Authorization": f"Bearer {token_org}"},
    )
    assert res_remove.status_code == 200
