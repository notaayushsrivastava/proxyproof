# ProxyProof Architecture Specification

## 1. System Overview

ProxyProof is an automated attendance validation platform composed of:
1. **Mobile Application (Expo React Native SDK 57)**:
   - Role-tailored UI for `student`, `organizer`, and `admin`.
   - Native BLE advertising (Organizer) & scanning (Student).
   - Local device keypair registration using `expo-secure-store`.
   - Real-time updates via WebSocket with REST polling fallback.
2. **Backend Service (Python FastAPI)**:
   - Versioned REST API (`/api/v1`).
   - Authenticated WebSocket endpoint (`/api/v1/ws/sessions/{session_id}`).
   - Attendance validation engine enforcing account state, device registration, enrolment, token freshness, and proximity heuristics.
   - Idempotent marking engine preventing duplicate records.
3. **Database & Infrastructure (PostgreSQL 17 in Docker Compose)**:
   - Pinned `postgres:17-alpine` container.
   - Persistent volume `proxyproof_postgres_data`.
   - Schema managed via Alembic migrations.
   - Immutable audit logs and security attempt tracking.

---

## 2. Component Diagram

```
+--------------------------------------------------------------------------+
|                            ProxyProof Mobile App                         |
|                                                                          |
|  +----------------------+  +---------------------+  +-----------------+  |
|  |     Student Flow     |  |    Organizer Flow   |  |   Admin Flow    |  |
|  | - Scan & RSSI Filter |  | - Session Setup     |  | - User/Classes  |  |
|  | - Auto Attendance    |  | - BLE Advertising   |  | - Device Queue  |  |
|  | - History & Summary  |  | - Live WS Dashboard|  | - Audit Inspect |  |
|  | - Device Requests    |  | - CSV Export        |  |                 |  |
|  +----------------------+  +---------------------+  +-----------------+  |
|             |                         |                                  |
|             +------------+------------+                                  |
|                          |                                               |
|              +------------------------+                                  |
|              |     BeaconAdapter      |                                  |
|              | (Native BLE / Mock BLE)|                                  |
|              +------------------------+                                  |
+--------------------------|-----------------------------------------------+
                           | HTTPS REST / WSS
                           v
+--------------------------------------------------------------------------+
|                           FastAPI Backend (API)                          |
|                                                                          |
|  [Auth & Security]      [Attendance Engine]        [WebSocket Hub]       |
|  - JWT / Argon2id       - Rotating HMAC Check      - Session broadcasts  |
|  - Device Key Verify    - Enrollment & Window      - Reconnect snapshot  |
|  - RBAC Middleware      - RSSI Heuristic           - Organizer auth check|
|                         - Idempotent (Sess, Stud)                        |
|                                                                          |
|  [Audit Service]        [Roster & Class Service]                         |
|  - Immutable logs       - Unique membership                              |
|  - Reason tracking      - CSV Formula Sanitization                       |
+--------------------------|-----------------------------------------------+
                           |
                           v
+--------------------------------------------------------------------------+
|                          PostgreSQL 17 Database                          |
|                                                                          |
|  - users / student_profiles                                              |
|  - devices (partial unique: 1 active per student)                        |
|  - device_change_requests (atomic transition)                            |
|  - classes / class_memberships                                           |
|  - attendance_sessions (ends_at > started_at)                            |
|  - attendance_records (UNIQUE session_id, student_id)                    |
|  - attendance_attempts (rate-limiting / forensics)                       |
|  - audit_logs (append-only)                                              |
+--------------------------------------------------------------------------+
```

---

## 3. End-to-End Flow: Attendance Marking

1. **Session Creation**:
   - Organizer initiates session for assigned Class ID with duration (e.g. 5 min).
   - API creates `attendance_sessions` row, generates 256-bit `session_secret`, and stores it encrypted.
   - API returns `sessionId`, `sessionSecret`, `startedAt`, `endsAt` to Organizer only.
2. **Organizer Advertising**:
   - Mobile `BeaconAdapter` starts advertising Service UUID `0000FF10-0000-1000-8000-00805F9B34FB`.
   - Every 5s, computes fresh proof `HMAC-SHA256(secret, 1 || sessionId || slot)` and updates characteristic.
3. **Student Detection**:
   - Student enters room; app detects service UUID and collects >= 3 RSSI readings.
   - Computes robust median RSSI.
   - Reads current characteristic payload (`sessionId`, `slot`, `proof`).
4. **Attendance Submission**:
   - Student app sends `POST /api/v1/sessions/{session_id}/attendance-attempts`:
     - Payload: `proof`, `time_slot`, `rssi_median`, `rssi_samples`, `request_id` (idempotency key).
     - Signed with device private key (or device registration token).
5. **Server Verification**:
   - Verifies JWT identity (derived student, active status).
   - Checks student device status == `active`.
   - Confirms enrollment in class associated with session.
   - Verifies session is `active` and `now < ends_at`.
   - Validates proof using constant-time HMAC check against slot drift window `[-1, 0, +1]`.
   - Validates RSSI >= threshold (e.g. `-75 dBm`).
   - Inserts `attendance_records` inside transaction with unique `(session_id, student_id)`.
   - Appends forensic attempt record to `attendance_attempts`.
6. **Live Broadcast**:
   - Publishes `attendance.marked` event to Organizer's active WebSocket channel.
   - Organizer's live attendance roster updates in real-time.
