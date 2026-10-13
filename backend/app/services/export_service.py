import csv
import io
from typing import List
from backend.app.schemas.attendance import AttendanceRecordResponse


def sanitize_csv_cell(value: str) -> str:
    """
    Guards against Spreadsheet Formula Injection (CSV Injection / CWE-1236).
    If a field starts with '=', '+', '-', or '@', prefixes with a single quote.
    """
    if not value:
        return ""
    str_val = str(value)
    if str_val and str_val[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{str_val}"
    return str_val


def generate_attendance_csv(
    records: List[dict],
    class_name: str,
    class_code: str,
) -> str:
    """
    Generates a UTF-8 RFC 4180 CSV export with formula sanitization.
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)

    # Header
    writer.writerow([
        "Class Code",
        "Class Name",
        "Session ID",
        "Student ID",
        "Student Name",
        "Student Roll Number",
        "Student Email",
        "Status",
        "Marking Source",
        "Marked At (UTC)",
        "Correction Reason",
    ])

    for r in records:
        writer.writerow([
            sanitize_csv_cell(class_code),
            sanitize_csv_cell(class_name),
            sanitize_csv_cell(r.get("session_id", "")),
            sanitize_csv_cell(r.get("student_id", "")),
            sanitize_csv_cell(r.get("student_name", "")),
            sanitize_csv_cell(r.get("student_number", "")),
            sanitize_csv_cell(r.get("student_email", "")),
            sanitize_csv_cell(r.get("status", "")),
            sanitize_csv_cell(r.get("source", "")),
            sanitize_csv_cell(r.get("marked_at", "")),
            sanitize_csv_cell(r.get("reason", "")),
        ])

    return output.getvalue()
