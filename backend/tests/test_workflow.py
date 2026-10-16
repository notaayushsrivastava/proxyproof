import uuid
import pytest
from fastapi.testclient import TestClient


def test_faculty_management_and_student_roster_workflows(client: TestClient):
    # 1. Register a new institution
    inst_code = f"INST_{uuid.uuid4().hex[:6].upper()}"
    inst_res = client.post(
        "/api/v1/institutions/register",
        json={
            "institution_name": "Stanford University Test",
            "institution_code": inst_code,
            "domain": f"{inst_code.lower()}.edu",
            "admin_name": "Dean Admin",
            "admin_email": f"dean@{inst_code.lower()}.edu",
            "admin_password": "AdminPassword123!",
            "department": "School of Engineering",
        },
    )
    assert inst_res.status_code == 201, inst_res.text
    inst_data = inst_res.json()
    admin_token = inst_data["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Admin creates a single faculty member
    faculty_email = f"prof1@{inst_code.lower()}.edu"
    fac_res = client.post(
        "/api/v1/institutions/faculty",
        headers=admin_headers,
        json={
            "full_name": "Dr. Claude Shannon",
            "email": faculty_email,
            "department": "Information Theory",
            "password": "FacultyPassword123!",
        },
    )
    assert fac_res.status_code == 201, fac_res.text
    fac_data = fac_res.json()
    assert fac_data["full_name"] == "Dr. Claude Shannon"
    assert fac_data["role"].lower() == "organizer"

    # 3. Admin mass uploads faculty via CSV
    csv_faculty = f"""Name,Email,Department,Password
Prof. Ada Lovelace,ada@{inst_code.lower()}.edu,Computer Science,AdaPass@123
Prof. John von Neumann,john@{inst_code.lower()}.edu,Applied Math,JohnPass@123
"""
    bulk_fac_res = client.post(
        "/api/v1/institutions/faculty/bulk-csv",
        headers=admin_headers,
        json={"csv_content": csv_faculty},
    )
    assert bulk_fac_res.status_code == 200, bulk_fac_res.text
    bulk_fac_data = bulk_fac_res.json()
    assert bulk_fac_data["created_count"] == 2
    assert bulk_fac_data["failed_count"] == 0

    # 4. List faculty for this institution
    list_fac = client.get("/api/v1/institutions/faculty", headers=admin_headers)
    assert list_fac.status_code == 200
    fac_list = list_fac.json()
    assert len(fac_list) >= 3
    emails = [f["email"] for f in fac_list]
    assert faculty_email in emails
    assert f"ada@{inst_code.lower()}.edu" in emails

    # 5. Log in as one of the newly created faculty members
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": faculty_email, "password": "FacultyPassword123!"},
    )
    assert login_res.status_code == 200, login_res.text
    fac_token = login_res.json()["access_token"]
    fac_headers = {"Authorization": f"Bearer {fac_token}"}

    # 6. Faculty creates a class
    class_code = f"CS_{uuid.uuid4().hex[:4].upper()}"
    class_res = client.post(
        "/api/v1/classes",
        headers=fac_headers,
        json={"name": "Information & Cryptography", "code": class_code},
    )
    assert class_res.status_code == 201, class_res.text
    class_id = class_res.json()["id"]

    # 7. Faculty creates a single student and enrolls them
    student_roll = f"ROLL_{uuid.uuid4().hex[:6].upper()}"
    student_res = client.post(
        f"/api/v1/classes/{class_id}/students",
        headers=fac_headers,
        json={
            "full_name": "Grace Hopper",
            "email": f"grace_{student_roll.lower()}@stanford.edu",
            "student_number": student_roll,
            "department": "Computer Science",
            "password": "StudentPassword123!",
        },
    )
    assert student_res.status_code == 201, student_res.text
    assert student_res.json()["full_name"] == "Grace Hopper"
    assert student_res.json()["student_number"] == student_roll

    # 8. Faculty mass uploads students via CSV into class roster
    s1_roll = f"ST_{uuid.uuid4().hex[:5].upper()}"
    s2_roll = f"ST_{uuid.uuid4().hex[:5].upper()}"
    csv_students = f"""Full Name,Email,Student ID,Department
Margaret Hamilton,hamilton_{s1_roll.lower()}@stanford.edu,{s1_roll},Software Engineering
Katherine Johnson,johnson_{s2_roll.lower()}@stanford.edu,{s2_roll},Orbital Mechanics
"""
    bulk_students_res = client.post(
        f"/api/v1/classes/{class_id}/students/bulk-csv",
        headers=fac_headers,
        json={"csv_content": csv_students},
    )
    assert bulk_students_res.status_code == 200, bulk_students_res.text
    bulk_stu_data = bulk_students_res.json()
    assert bulk_stu_data["created_count"] == 2
    assert bulk_stu_data["enrolled_count"] == 2
    assert bulk_stu_data["failed_count"] == 0

    # 9. Verify class roster now contains all 3 students
    roster_res = client.get(f"/api/v1/classes/{class_id}/roster", headers=fac_headers)
    assert roster_res.status_code == 200, roster_res.text
    roster = roster_res.json()
    assert len(roster) == 3
    roster_rolls = [m["student_number"] for m in roster]
    assert student_roll in roster_rolls
    assert s1_roll in roster_rolls
    assert s2_roll in roster_rolls
