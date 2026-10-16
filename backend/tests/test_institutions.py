import uuid
import pytest
from fastapi.testclient import TestClient


def test_institution_registration_and_management_lifecycle(client: TestClient):
    unique_suffix = uuid.uuid4().hex[:6]
    institution_data = {
        "institution_name": f"University of Technology {unique_suffix}",
        "institution_code": f"TECH_{unique_suffix.upper()}",
        "domain": f"tech-{unique_suffix}.edu",
        "admin_name": "Dean Arthur Vance",
        "admin_email": f"dean_{unique_suffix}@tech.edu",
        "admin_password": "SecurePassword123!",
        "department": "Faculty of Computer Engineering",
    }

    # 1. Register Institution
    reg_res = client.post("/api/v1/institutions/register", json=institution_data)
    assert reg_res.status_code == 201, reg_res.text
    data = reg_res.json()
    assert "access_token" in data
    assert data["institution"]["name"] == institution_data["institution_name"]
    assert data["institution"]["code"] == institution_data["institution_code"]
    assert data["admin_user"]["role"] == "admin"
    assert data["admin_user"]["email"] == institution_data["admin_email"]

    token = data["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 2. Duplicate registration rejection
    dup_res = client.post("/api/v1/institutions/register", json=institution_data)
    assert dup_res.status_code == 409

    # 3. Get /me endpoint with issued token
    me_res = client.get("/api/v1/institutions/me", headers=auth_headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["code"] == institution_data["institution_code"]
    assert me_data["hardware_binding_enforced"] is True

    # 4. Update policy settings via PATCH /me
    patch_res = client.patch(
        "/api/v1/institutions/me",
        headers=auth_headers,
        json={
            "hardware_binding_enforced": True,
            "attendance_window_seconds": 20,
            "department": "School of Computing & AI",
        },
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["attendance_window_seconds"] == 20
    assert patch_res.json()["department"] == "School of Computing & AI"

    # 5. Get Overview Stats
    stats_res = client.get("/api/v1/institutions/overview", headers=auth_headers)
    assert stats_res.status_code == 200
    stats_data = stats_res.json()
    assert "total_classes" in stats_data
    assert "total_faculty" in stats_data
    assert "total_students" in stats_data

    # 6. List Institutions
    list_res = client.get("/api/v1/institutions/list")
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(inst["code"] == institution_data["institution_code"] for inst in items)
