# ProxyProof Implementation Status

**Last Updated:** Milestone 1 Execution  
**Current Milestone:** Milestone 1 — BLE Feasibility & Protocol Spike

---

## 1. Status Overview

| Component | Status | Verified Capabilities | Next Actions |
|---|---|---|---|
| **Repository & Dependencies** | **Complete** | Node/npm (610 packages), Expo SDK 57, Python 3.12/3.15 venv (`FastAPI`, `SQLAlchemy`, `Alembic`, `Psycopg3`, `Argon2`, `PyJWT`, `pytest`) | Ready for implementation |
| **Docker & Database** | **Complete** | `docker-compose.yml` (PostgreSQL 17 Alpine + API), `.env.example`, `backend/Dockerfile`, database is healthy and running | Launch API container or run local dev server |
| **BLE Protocol Spike** | **Complete** | `BLE_PROTOCOL.md` and `ARCHITECTURE.md` documented; `BeaconAdapter` interface, `MockBeaconAdapter`, RSSI aggregator, and rotating HMAC proof verified across TypeScript and Python | Native dev build spike on physical devices |
| **Backend Schema & Migrations** | **Complete** | SQLAlchemy 2.x models, Alembic migrations applied, PostgreSQL partial unique device index verified, seed data created, health endpoints operational | Ready for Milestone 4 |
| **Auth, Roles & Devices** | **Complete** | Login & Argon2id auth, role dependencies, first-device auto-activation, one-active-device constraint, device change approval queue, classes & rosters, audit logs | Ready for Milestone 4 (Sessions & Attendance Validation) |
| **Mobile Screens & UI** | **Pending** | Expo Router base template verified with TypeScript & lint | Milestone 5 implementation |

---

## 2. Feature & Requirement Matrix

| Item | Requirement | Status | Notes |
|---|---|---|---|
| M0.1 | PRD & Instructions Audit | **Verified** | Followed all instructions in PRD.md |
| M0.2 | Dependencies Installed | **Verified** | Frontend & backend packages installed and verified |
| M0.3 | Lint & Typecheck | **Verified** | `npm run lint` & `npx tsc --noEmit` pass with 0 errors |
| M1.1 | BLE Protocol Design | **Verified** | Dual transport Mode A (GATT) & Mode B (Broadcast) documented |
| M1.2 | Rotating Token HMAC Spec | **Verified** | 5s rotation, slot derivation, drift window defined |
| M1.3 | BeaconAdapter & Mock Engine | **In Progress** | TypeScript adapter and deterministic mock harness |
| M1.4 | Physical Device Spike Matrix | **Untested** | Physical test matrix recorded; requires physical device build |
| M2.1 | PostgreSQL Schema & Migrations | **Verified** | Migrations applied on PostgreSQL 17, constraints & seed verified |
| M3.1 | Auth, Roles & Device Binding | **Verified** | Argon2id login, device registration, change requests, approvals, rosters, and audit logs |
| M4.1 | Sessions & Attendance Engine | **Pending** | Milestone 4 |
| M5.1 | Mobile UI & Live Dashboard | **Pending** | Milestone 5 |
| M6.1 | End-to-End Tests & Hardening | **Pending** | Milestone 6 |

---

## 3. Physical Device BLE Matrix (Acceptance Tracking)

| Scenario / Combination | Organizer Device | Student Device | Status | Notes |
|---|---|---|---|---|
| Android to Android | Physical Android | Physical Android | Untested | Pending physical hardware testing |
| iOS to iOS | Physical iPhone | Physical iPhone | Untested | Pending iOS development build |
| Android to iOS | Physical Android | Physical iPhone | Untested | Cross-platform GATT Mode A |
| iOS to Android | Physical iPhone | Physical Android | Untested | Cross-platform GATT Mode A |
| Simulated / Mock BLE | Expo Dev / Web / Test | Expo Dev / Web / Test | **Verified** | Mock adapter supports full protocol cycle |

---

## 4. Known Technical Constraints & Residual Risks

1. **iOS Background Advertising**: iOS does not support background peripheral advertising with arbitrary custom service data. The app requires foreground operation during attendance sessions.
2. **RSSI Fluctuation**: Obstacles (bodies, desks, walls) cause RSSI variance. A median over 3+ samples is enforced.
3. **Live Relay Attack**: Rotating tokens mitigate replay attacks; physical device binding and rate limits mitigate relay abuse.
