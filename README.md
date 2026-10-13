# ProxyProof — Cryptographically Verified BLE Classroom Attendance

ProxyProof is an attendance verification system designed for university lecture halls and classrooms. It replaces fraud-prone QR codes and manual roll-calls with Bluetooth Low Energy (BLE) proximity detection, short-lived rotating HMAC-SHA-256 tokens, and hardware-bound student device verification.

---

## 1. System Architecture & Threat Model

### Cryptographic Rotating Proof Protocol
- **Organizer Advertising:** The organizer's device broadcasts a 21-byte payload every 5 seconds consisting of:
  `[1-byte protocol_version] || [16-byte session_uuid] || [4-byte big-endian time_slot]`.
- **Rotating HMAC-SHA-256:** The beacon payload includes a fresh HMAC token derived from a high-entropy server-generated `session_secret` (only delivered over TLS to the authorized organizer).
- **Time Slot Drift Window:** The server validates proofs within a strict clock-drift tolerance window ($\pm 1$ slot, corresponding to 5 seconds). Tokens older than 10 seconds or from the future are rejected.
- **Client-Reported RSSI Proximity Heuristic:** Student devices must collect $\ge 3$ RSSI samples over a 3–5 second window. An outlier rejection filter (-100 dBm to -20 dBm) computes a robust median. Marks require median signal $\ge -75$ dBm.
- **One Active Device Constraint:** Enforced at the PostgreSQL level via a partial unique index (`uq_one_active_device_per_student`). Switching phones requires administrative approval, which atomically revokes the old device key and activates the new key.
- **Idempotent Marking & Auditability:** Attendance submission is idempotent on `(session_id, student_id)`. All manual adjustments, deletions, and device approvals require recorded reasons and are permanently appended to the institutional audit log.
- **Spreadsheet Security:** CSV exports implement RFC 4180 escaping with formula injection sanitization (values starting with `=`, `+`, `-`, or `@` are safely apostrophe-prefixed).

---

## 2. Prerequisites

- **Docker & Docker Compose** (PostgreSQL 17)
- **Python 3.11+** (FastAPI backend)
- **Node.js 20+** and **npm** (Expo mobile application)
- **Git**

---

## 3. Quick Start (Step-by-Step)

### Step 3.1: Start PostgreSQL with Docker Compose

```powershell
docker compose up -d db
```
Verify the container is healthy:
```powershell
docker ps --filter "name=proxyproof_db"
```

### Step 3.2: Configure Environment

Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```

Default local database connection in `.env`:
```env
DATABASE_URL=postgresql+psycopg://proxyproof_user:proxyproof_secure_password_2026@127.0.0.1:5432/proxyproof_db
JWT_SECRET_KEY=dev_insecure_jwt_secret_key_change_in_production_998877665544332211
BEACON_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### Step 3.3: Set Up Backend Virtual Environment & Run Migrations

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run Alembic database migrations
alembic upgrade head

# Seed institutional development accounts and classes
$env:PYTHONPATH=".."
python -m app.db.seed
```

### Step 3.4: Launch FastAPI API Server

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- **API Base URL:** `http://127.0.0.1:8000/api/v1`
- **Interactive Swagger Documentation:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 4. Launching the Expo Mobile Application

In a separate terminal:
```powershell
cd frontend
npm install
npm start
```
- Press **w** to run in the web browser.
- Press **a** to launch on Android emulator.
- Press **i** to launch on iOS simulator.

### Running in Expo Web / Browser Preview
The web client connects directly to `http://127.0.0.1:8000/api/v1` and connects to the active session WebSocket at `ws://127.0.0.1:8000/api/v1/ws/sessions/{id}`.

---

## 5. Development Test Credentials

The database seed provides ready-to-test campus accounts:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Student** | `alice@university.local` | `StudentPass123!` | Roll: `2026-CS-001`, Active Device Registered |
| **Student** | `bob@university.local` | `StudentPass123!` | Roll: `2026-CS-002`, Unenrolled from test class |
| **Organizer** | `smith@university.local` | `ProfPass123!` | Instructor for `CS401-2026` |
| **Admin** | `admin@university.local` | `AdminPass123!` | System Administrator, Device Queue Approver |

*The login screen contains quick autofill buttons for these test accounts for immediate pair-programming evaluation.*

---

## 6. Running Automated Tests

### Backend Test Suite (15 Integration & Unit Tests)
```powershell
cd c:\Users\Aayush\Desktop\python_projects_shared\vinnovateit\app-dev
$env:PYTHONPATH="."
backend\.venv\Scripts\pytest -v backend\tests
```
Verifies:
- PostgreSQL database connectivity & health checks
- Argon2id password hashing & JWT token issue/decode
- PostgreSQL partial unique index (`uq_one_active_device_per_student`)
- Attendance uniqueness constraint (`uq_attendance_session_student`)
- Rotating HMAC-SHA-256 drift validation
- Role guards (`student`, `organizer`, `admin`)
- Device registration & atomic change request approval
- Scoped class & roster permissions
- Complete 10-step attendance validation engine
- RFC 4180 CSV export with formula injection sanitization

### Frontend Test Suite (11 Unit Tests)
```powershell
cd frontend
npm test
```
Verifies:
- 5-second time slot calculation and boundary transitions
- 21-byte canonical proof message construction
- 32-character HMAC token derivation and validation
- Clock-drift verification and rejection of stale/tampered tokens
- Outlier filtering ($-100$ to $-20\text{ dBm}$)
- Median calculations over odd and even sample sets
- Proximity policy threshold checking ($\ge -75\text{ dBm}$)
- MockBeaconAdapter scanning & advertising lifecycles

### Frontend Linting & Typechecking
```powershell
cd frontend
npx tsc --noEmit
npm run lint
```
Both commands pass with **0 errors and 0 warnings**.

---

## 7. API Endpoints Overview

All routes are versioned under `/api/v1`:

### Authentication & Profile
- `POST /api/v1/auth/login` — Authenticate and receive JWT access token
- `GET /api/v1/auth/me` — Authenticated user profile
- `POST /api/v1/auth/logout` — Invalidate user session

### Device Binding
- `POST /api/v1/devices/register` — Register hardware public key (auto-activates if first device)
- `GET /api/v1/devices/me` — Get current active device status
- `POST /api/v1/devices/change-requests` — Submit request to swap phone
- `GET /api/v1/devices/change-requests/me` — List student's change request history

### Classes & Rosters
- `GET /api/v1/classes` — Assigned classes for organizers; enrolled classes for students
- `GET /api/v1/classes/{id}` — Class details
- `GET /api/v1/classes/{id}/roster` — Enrolled roster with device readiness
- `POST /api/v1/classes/{id}/members` — Add student to roster
- `DELETE /api/v1/classes/{id}/members/{student_id}` — Remove student from roster

### Sessions & Attendance
- `POST /api/v1/classes/{id}/sessions` — Start attendance session & receive beacon secret
- `GET /api/v1/sessions/active` — List currently active sessions visible to the user
- `GET /api/v1/sessions/{id}` — Session status and timestamps
- `POST /api/v1/sessions/{id}/close` — Close active session immediately
- `POST /api/v1/sessions/{id}/attendance-attempts` — Submit BLE proof & RSSI telemetry
- `GET /api/v1/sessions/{id}/attendance` — Live session attendance list
- `POST /api/v1/sessions/{id}/attendance/manual` — Manual mark with required reason
- `DELETE /api/v1/sessions/{id}/attendance/{student_id}` — Auditable attendance removal
- `GET /api/v1/sessions/{id}/export.csv` — Formula-safe CSV export stream

### Student Summary
- `GET /api/v1/students/me/attendance-summary` — Server-calculated attendance rate
- `GET /api/v1/students/me/attendance-history` — Session-by-session history

### Admin
- `GET /api/v1/admin/device-change-requests` — Pending device replacement queue
- `POST /api/v1/admin/device-change-requests/{id}/approve` — Atomically activate new device & revoke old
- `POST /api/v1/admin/device-change-requests/{id}/reject` — Reject replacement request
- `GET /api/v1/admin/audit-logs` — Immutable audit log inspection

### Real-Time WebSocket
- `WS /api/v1/ws/sessions/{id}?token={jwt}` — Live event stream (`attendance.marked`, `attendance.corrected`, `session.closed`)

---

## 8. Physical BLE Test Matrix & Limitations

| Combination | Advertising (Organizer) | Scanning (Student) | Proof Validation | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Android $\rightarrow$ Android** | Supported | Supported | Verified | Dynamic advertising payload fully supported on Android 8+ (BLE 5.0) |
| **Android $\rightarrow$ iOS** | Supported | Supported | Verified | Foreground CoreBluetooth scanning verified |
| **iOS $\rightarrow$ Android** | Restricted (iBeacon format) | Supported | Verified | iOS prohibits dynamic custom manufacturer data when backgrounded |
| **iOS $\rightarrow$ iOS** | Restricted (iBeacon format) | Supported | Verified | Foreground scanning required; payload must be compact |
| **Web Dev Harness** | Simulated (MockAdapter) | Simulated (MockAdapter) | Verified | Full end-to-end WebSocket + REST workflow functional |

### Residual Threats & Known Limitations
1. **Live Relay Attack:** A student physically in class can forward fresh tokens over the internet to an absent student in real time. Mitigated through tight 5-second validity slots, client-reported RSSI thresholds, and attempt telemetry anomaly detection.
2. **Foreground Requirement:** OS battery optimizations suspend BLE scanning when apps are backgrounded. Students must have the app open in foreground during roll-call.
3. **RSSI Environmental Variance:** RSSI varies with body shielding, walls, and phone orientation. Proximity threshold is calibrated at $-75\text{ dBm}$ (configurable).
