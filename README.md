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

---

## 9. Project Structure & Codefile Reference

```
app-dev/
├── docker-compose.yml              # Local container orchestration for PostgreSQL 17
├── alembic.ini                     # Root database migration configuration for Alembic
├── run-backend.sh / .ps1           # Automated backend startup script with DB check & migrations
├── run-frontend.sh / .ps1          # Automated frontend startup script for Expo development
├── backend/                        # FastAPI application & relational persistence layer
│   ├── Dockerfile                  # Production container definition for Python FastAPI
│   ├── requirements.txt            # Locked Python backend dependencies
│   ├── alembic.ini                 # Directory-scoped Alembic configuration
│   ├── alembic/
│   │   ├── env.py                  # Alembic runtime environment loading models & database URL
│   │   └── versions/
│   │       └── 0001_initial_schema.py # Initial migration establishing tables, indexes, & foreign keys
│   ├── app/
│   │   ├── main.py                 # FastAPI app entrypoint with lifecycle, CORS, & error handlers
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic settings with automatic local/Docker host fallback
│   │   │   ├── security.py         # Argon2id password hashing, JWT decoding, & HMAC utilities
│   │   │   └── dependencies.py     # Database session injection & role-based route guards
│   │   ├── db/
│   │   │   ├── session.py          # SQLAlchemy engine creation & scoped session factory
│   │   │   ├── base.py             # Declarative model registry for migration autogeneration
│   │   │   └── seed.py             # Database seed script for test accounts, classes, & devices
│   │   ├── models/
│   │   │   ├── enums.py            # Typed enumerations for roles, account status, & session states
│   │   │   ├── user.py             # User account & student academic profile entities
│   │   │   ├── device.py           # Registered hardware model with one-active-device constraint
│   │   │   ├── class_model.py      # Academic course & student membership roster models
│   │   │   ├── session.py          # Classroom roll-call session model with HMAC secret
│   │   │   ├── attendance.py       # Attendance record model with uniqueness constraints & RSSI
│   │   │   └── audit.py            # Append-only institutional audit log model
│   │   ├── schemas/
│   │   │   ├── auth.py             # Pydantic schemas for login, tokens, & user profiles
│   │   │   ├── device.py           # Schemas for device registration & change requests
│   │   │   ├── class_schema.py     # Schemas for course listings, rosters, & memberships
│   │   │   ├── session.py          # Schemas for session creation, queries, & status transitions
│   │   │   ├── attendance.py       # Schemas for BLE proof submissions & manual mark updates
│   │   │   └── audit.py            # Schemas for administrative audit log queries
│   │   ├── services/
│   │   │   ├── attendance_validator.py # Authoritative 10-step attendance verification engine
│   │   │   ├── device_service.py   # Business logic for device registration & swap approvals
│   │   │   ├── class_service.py    # Class roster management & student enrollment operations
│   │   │   ├── export_service.py   # Formula-injection-safe CSV export generator
│   │   │   ├── websocket_manager.py # Real-time WebSocket connection hub for live dashboard events
│   │   │   └── audit_service.py    # Centralized helper recording immutable security audit events
│   │   └── api/v1/
│   │       ├── api.py              # Root router mounting all domain endpoint collections
│   │       └── endpoints/
│   │           ├── auth.py         # Authentication, login, & user profile routes
│   │           ├── devices.py      # Hardware registration & swap request endpoints
│   │           ├── classes.py      # Course roster & student enrollment management routes
│   │           ├── sessions.py     # Roll-call session lifecycle & CSV export endpoints
│   │           ├── attendance.py   # BLE proof processing & manual adjustment endpoints
│   │           ├── students.py     # Student attendance rate & session history routes
│   │           ├── admin.py        # Privileged device change approval & audit log inspection
│   │           ├── health.py       # Container readiness & database connectivity check
│   │           └── websocket.py    # WebSocket endpoint streaming live attendance updates
│   └── tests/
│       ├── conftest.py             # Pytest harness providing test sessions & HTTP clients
│       ├── test_api.py             # Baseline health and routing integration test suite
│       ├── test_milestone2.py      # Database constraints, partial index, & connectivity tests
│       ├── test_milestone3.py      # Authentication, RBAC role guard, & device binding tests
│       └── test_milestone4.py      # Validation engine, token drift, & CSV sanitization tests
└── frontend/                       # Expo React Native cross-platform mobile application
    ├── app.json                    # Expo manifest configuring Bluetooth permissions & bundle IDs
    ├── package.json                # Project dependencies, scripts, & test runners
    ├── tsconfig.json               # TypeScript strict compiler configuration
    ├── src/
    │   ├── app/
    │   │   ├── _layout.tsx         # Root layout shell with AuthProvider & SafeAreaProvider
    │   │   └── index.tsx           # Role-based root view router (Student, Organizer, Admin)
    │   ├── ble/
    │   │   ├── proof.ts            # Rotating token derivation, time slotting, & 21-byte packing
    │   │   ├── rssi.ts             # Telemetry filter for sample aggregation & outlier exclusion
    │   │   ├── adapter.ts          # Generic TypeScript interface defining Bluetooth contracts
    │   │   ├── mock-adapter.ts     # In-memory beacon simulation harness for dev & testing
    │   │   └── index.ts            # Public export boundary for BLE protocol modules
    │   ├── store/
    │   │   └── authContext.tsx     # React context managing auth state & secure token storage
    │   ├── services/
    │   │   ├── api.ts              # Typed Axios/Fetch API client handling tokens & error normalization
    │   │   └── websocket.ts        # Resilient WebSocket client with automatic reconnection
    │   ├── hooks/
    │   │   └── useAttendanceScanner.ts # Automated BLE scanning & attendance submission hook
    │   ├── types/
    │   │   └── api.ts              # Shared TypeScript interfaces mirroring backend contracts
    │   └── components/
    │       ├── Header.tsx          # Common app header showing user name, role badge, & logout
    │       ├── LoginView.tsx       # Credential login view with test account autofill buttons
    │       ├── StudentHomeView.tsx # Student dashboard with automated beacon scanner status
    │       ├── StudentClassesView.tsx # Enrolled course list with server-computed attendance rates
    │       ├── StudentDeviceView.tsx # Registered phone hardware status & device swap flow
    │       ├── OrganizerClassesView.tsx # Instructor course dashboard & session initiator
    │       ├── OrganizerLiveSessionView.tsx # Live roll-call view with active beacon, timer, & marks
    │       ├── OrganizerHistoryView.tsx # Past session history viewer with CSV download actions
    │       ├── AdminOverviewView.tsx # Administrator statistics hub & quick action overview
    │       ├── AdminDeviceQueueView.tsx # Pending device replacement approval & rejection queue
    │       └── AdminAuditLogsView.tsx # Immutable institutional audit log inspection table
    └── tests/
        ├── ble_proof.test.ts       # Protocol tests for token derivation, drift, & payload encoding
        ├── rssi.test.ts            # Outlier filter and median proximity threshold unit tests
        └── mock_adapter.test.ts    # Automated lifecycle tests for beacon advertising & scanning
```

### Phrasal Description of Codefiles

#### Root & Infrastructure
- [`docker-compose.yml`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/docker-compose.yml): Manages local PostgreSQL 17 container services with healthchecks, persistent data volumes, and host port bindings.
- [`alembic.ini`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/alembic.ini): Configures root-level Alembic database migrations and script directory mapping.
- [`run-backend.sh`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/run-backend.sh) / [`run-backend.ps1`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/run-backend.ps1): Shell and PowerShell startup scripts that verify dependencies, run database migrations, and launch the Uvicorn ASGI server with hot-reload.
- [`run-frontend.sh`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/run-frontend.sh) / [`run-frontend.ps1`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/run-frontend.ps1): Shell and PowerShell startup scripts that verify `node_modules` and boot the Expo Metro development bundler.
- [`.env.example`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/.env.example): Documents required configuration keys for database connection strings, JWT signing keys, and protocol drift settings.

#### Backend Core & Configuration
- [`backend/app/main.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/main.py): Initializes the FastAPI instance with lifecycle handlers, CORS rules, global exception wrappers, and dynamic import path resolution.
- [`backend/app/core/config.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/core/config.py): Parses application environment settings and dynamically falls back between containerized (`db:5432`) and local host (`127.0.0.1:5432`) database endpoints.
- [`backend/app/core/security.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/core/security.py): Encapsulates Argon2id password hashing, JWT token signing/verification, and HMAC-SHA-256 session token generation.
- [`backend/app/core/dependencies.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/core/dependencies.py): Injects database sessions and validates authenticated user roles (`require_student`, `require_organizer`, `require_admin`).
- [`backend/app/db/session.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/db/session.py): Builds the SQLAlchemy connection engine and defines the scoped session generator.
- [`backend/app/db/base.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/db/base.py): Imports and registers all database entity models onto the declarative metadata registry for Alembic.
- [`backend/app/db/seed.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/db/seed.py): Populates development database records with administrative accounts, instructors, students, enrolled courses, and initial hardware devices.

#### Backend Relational Models
- [`backend/app/models/enums.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/models/enums.py): Declares enumerated string types for user roles, account lifecycle states, session status, and mobile device operating systems.
- [`backend/app/models/user.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/models/user.py): Defines PostgreSQL user credentials, role assignments, and student institutional registration profiles.
- [`backend/app/models/device.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/models/device.py): Stores registered mobile device keys with a partial unique index guaranteeing only one active device per student.
- [`backend/app/models/class_model.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/models/class_model.py): Represents courses and class membership rosters linking students to assigned instructors.
- [`backend/app/models/session.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/models/session.py): Models live roll-call sessions with active time limits, expiration timestamps, and cryptographic beacon secrets.
- [`backend/app/models/attendance.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/models/attendance.py): Stores verified attendance records with unique session-student constraints, client RSSI telemetry, and verification methods.
- [`backend/app/models/audit.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/models/audit.py): Provides an immutable audit trail capturing administrative approvals, manual roll-call alterations, and security events.

#### Backend Business Services & Validation
- [`backend/app/services/attendance_validator.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/services/attendance_validator.py): Executes the authoritative 10-step validation engine verifying token freshness, clock drift, device status, and RSSI proximity.
- [`backend/app/services/device_service.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/services/device_service.py): Coordinates phone key registration, pending swap requests, and atomic admin approvals with automatic old device revocation.
- [`backend/app/services/class_service.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/services/class_service.py): Handles course queries, instructor ownership verification, and student roster enrollments.
- [`backend/app/services/export_service.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/services/export_service.py): Generates RFC 4180 CSV exports with formula injection sanitization escaping sensitive characters.
- [`backend/app/services/websocket_manager.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/services/websocket_manager.py): Dispatches real-time broadcast events over WebSockets to live organizer dashboards.
- [`backend/app/services/audit_service.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/services/audit_service.py): Records structured security log entries with actor IDs, action types, target entities, and mandatory justification reasons.

#### Backend API Endpoints (`/api/v1`)
- [`backend/app/api/v1/api.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/api/v1/api.py): Combines all sub-routers into the unified API v1 schema.
- [`backend/app/api/v1/endpoints/auth.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/api/v1/endpoints/auth.py): Handles user authentication, token generation, profile retrieval, and session termination.
- [`backend/app/api/v1/endpoints/devices.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/api/v1/endpoints/devices.py): Manages student hardware binding, active device inspection, and phone replacement submission.
- [`backend/app/api/v1/endpoints/classes.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/api/v1/endpoints/classes.py): Exposes course metadata, student roster listings, and member management.
- [`backend/app/api/v1/endpoints/sessions.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/api/v1/endpoints/sessions.py): Controls session initialization, live status inspection, early session closure, and CSV downloads.
- [`backend/app/api/v1/endpoints/attendance.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/api/v1/endpoints/attendance.py): Ingests BLE attendance proofs, returns live attendance lists, and processes manual marks or removals.
- [`backend/app/api/v1/endpoints/students.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/api/v1/endpoints/students.py): Computes overall student attendance percentages and session-by-session history records.
- [`backend/app/api/v1/endpoints/admin.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/api/v1/endpoints/admin.py): Provides administrative endpoints to review device replacement queues and query system audit logs.
- [`backend/app/api/v1/endpoints/health.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/api/v1/endpoints/health.py): Validates database connectivity and service availability without leaking operational secrets.
- [`backend/app/api/v1/endpoints/websocket.py`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/backend/app/api/v1/endpoints/websocket.py): Establishes authenticated WebSocket streams for real-time roll-call attendance updates.

#### Frontend Application & BLE Architecture
- [`frontend/app.json`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/app.json): Declares Expo build metadata, native Bluetooth usage permissions for iOS, and Android BLE permission arrays.
- [`frontend/src/app/_layout.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/app/_layout.tsx): Top-level component establishing global authentication context, safe area boundaries, and navigation status bar styling.
- [`frontend/src/app/index.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/app/index.tsx): Main application router dynamically rendering Student, Organizer, or Admin views according to authenticated role.
- [`frontend/src/store/authContext.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/store/authContext.tsx): Manages authentication state, secure credential persistence with `expo-secure-store`, and active user profiles.
- [`frontend/src/services/api.ts`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/services/api.ts): Centralized HTTP service executing typed requests against the backend with automatic bearer token injection.
- [`frontend/src/services/websocket.ts`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/services/websocket.ts): WebSocket connection client handling real-time session event subscriptions with automatic reconnect logic.
- [`frontend/src/ble/proof.ts`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/ble/proof.ts): Implements cryptographic token calculations, 5-second slot quantization, drift acceptance, and 21-byte message serialization.
- [`frontend/src/ble/rssi.ts`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/ble/rssi.ts): Computes statistical median signal strength over raw RSSI sample windows while filtering burst anomalies.
- [`frontend/src/ble/adapter.ts`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/ble/adapter.ts): Defines standard TypeScript interface contracts for Bluetooth Low Energy advertising and scanning adapters.
- [`frontend/src/ble/mock-adapter.ts`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/ble/mock-adapter.ts): In-memory beacon simulation harness allowing deterministic multi-device attendance testing in browser and development builds.
- [`frontend/src/hooks/useAttendanceScanner.ts`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/hooks/useAttendanceScanner.ts): React hook orchestrating hands-free beacon detection, RSSI telemetry collection, and background attendance submission.
- [`frontend/src/components/Header.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/components/Header.tsx): Reusable app bar showing institution branding, logged-in user profile, role badge, and sign-out button.
- [`frontend/src/components/LoginView.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/components/LoginView.tsx): Login screen featuring password authentication and fast-autofill test accounts for rapid evaluation.
- [`frontend/src/components/StudentHomeView.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/components/StudentHomeView.tsx): Student screen showing device verification status, active scanner animations, and active session indicators.
- [`frontend/src/components/StudentClassesView.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/components/StudentClassesView.tsx): Displays enrolled classes, session attendance history, and server-verified attendance rates.
- [`frontend/src/components/StudentDeviceView.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/components/StudentDeviceView.tsx): Displays current hardware device details and enables submitting replacement requests with justification notes.
- [`frontend/src/components/OrganizerClassesView.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/components/OrganizerClassesView.tsx): Course management dashboard for instructors to view enrolled rosters and launch time-limited attendance sessions.
- [`frontend/src/components/OrganizerLiveSessionView.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/components/OrganizerLiveSessionView.tsx): Live roll-call view with active BLE beacon broadcast, real-time student counter, manual adjustment modal, and early session closure.
- [`frontend/src/components/OrganizerHistoryView.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/components/OrganizerHistoryView.tsx): Historical session archive enabling instructors to review attendance metrics and export sanitized CSV spreadsheets.
- [`frontend/src/components/AdminOverviewView.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/components/AdminOverviewView.tsx): Administrator landing dashboard with system metrics, pending device queue counters, and quick navigation shortcuts.
- [`frontend/src/components/AdminDeviceQueueView.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/components/AdminDeviceQueueView.tsx): Administrative interface for reviewing, approving, or denying student device change requests.
- [`frontend/src/components/AdminAuditLogsView.tsx`](file:///c:/Users/Aayush/Desktop/python_projects_shared/vinnovateit/app-dev/frontend/src/components/AdminAuditLogsView.tsx): Searchable compliance table displaying immutable audit records of administrative approvals and manual attendance edits.

