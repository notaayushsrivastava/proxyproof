# ProxyProof BLE Protocol Specification

**Version:** 1.0.0  
**Status:** Implementation Ready / Spike Design  
**Author:** ProxyProof Architecture Team

---

## 1. Overview & Constraints

ProxyProof uses Bluetooth Low Energy (BLE) to detect physical proximity between a class organizer's device and student devices during an active class session.

### Core Protocol Constraints & Realities

1. **iOS Advertising Payload Limits:**  
   Apple's `CBPeripheralManager.startAdvertising(_:)` restricts advertising packets in the peripheral role. Custom manufacturer data or arbitrary service data cannot be dynamically updated with custom bytes on iOS peripherals without triggering system limitations.
2. **Foreground Operation Baseline:**  
   Both organizer advertising and student scanning require foreground operation as the MVP baseline. Continuous background scanning and advertising across mixed iOS/Android ecosystems are not guaranteed by mobile operating systems without specialized beacons.
3. **RSSI Is a Noisy Heuristic:**  
   RSSI (Received Signal Strength Indicator) is observed client-side, fluctuates widely due to obstacles, phone orientation, and multi-path reflection. It cannot prove exact physical distance in meters. An aggregated median over multiple samples (`MIN_RSSI_SAMPLES >= 3`) with a configurable baseline (`-75 dBm`) is enforced.
4. **Rotating Proof Defense:**  
   The organizer device broadcasts/exposes a short-lived cryptographic token that rotates every **5 seconds** (`PROOF_VALIDITY_SECONDS`). A server clock-drift window allows only the current and immediately prior time slots (`DRIFT_WINDOW_SLOTS = 1`). This mitigates simple replay attacks and delayed code submissions.

---

## 2. UUID & GATT Specification

- **Service UUID:** `0000FF10-0000-1000-8000-00805F9B34FB` (ProxyProof Attendance Service)
- **Session Info Characteristic UUID:** `0000FF11-0000-1000-8000-00805F9B34FB` (Read, Notify)
  - Returns UTF-8 JSON or compact binary payload:
    `{ "sessionId": "<uuid>", "slot": <uint32>, "proof": "<hex>", "v": 1 }`
- **Proof Characteristic UUID:** `0000FF12-0000-1000-8000-00805F9B34FB` (Read, Notify)
  - Read-only short-lived token value.

### Two Transport Modes

| Mode | Target Platform | Mechanism |
|---|---|---|
| **Mode A (GATT Read)** | iOS & Android (Universal fallback) | Organizer advertises Service UUID `0000FF10...`. Student connects without pairing, reads characteristic `0000FF11`, records RSSI, and disconnects within < 1.5s. |
| **Mode B (Broadcast Service Data)** | Android-to-Android / Custom Beacons | Compact payload packed directly into 16-bit Service Data or Manufacturer Data: `[ProtocolVer: 1B] [SessionHash: 8B] [TimeSlot: 4B] [ProofTruncated: 8B]`. Student scans passively without connecting. |

---

## 3. Cryptographic Token Generation & Validation

### 3.1 Session Secret Generation (Backend)
When an authorized organizer creates a session:
1. Backend generates a high-entropy 256-bit secret: `session_secret = os.urandom(32)`.
2. Encrypted at rest in PostgreSQL (`beacon_secret_ciphertext`).
3. Returned strictly to the authenticated organizer upon session activation via TLS:
   ```json
   {
     "sessionId": "4f54e176-b9a2-4a0e-94dc-32bfb54d6824",
     "sessionSecret": "c3ab41... (hex)",
     "protocolVersion": 1,
     "proofValiditySeconds": 5
   }
   ```
4. **Never returned to students.**

### 3.2 Token Rotation (Organizer App)
Every 5 seconds (`slot = floor(epoch_seconds / 5)`):
$$\text{message} = \text{protocol\_version (1 byte)} \parallel \text{session\_id (UUID bytes)} \parallel \text{slot (4-byte big-endian)}$$
$$\text{proof} = \text{HMAC-SHA256}(\text{session\_secret}, \text{message})[0:16]$$ (encoded as 32-character hex)

The organizer updates its local GATT characteristic every 5 seconds.

### 3.3 Token Verification (Backend)
When student submits an attendance attempt with:
- `session_id`
- `proof`
- `client_time_slot`
- `request_id` (idempotency key)
- `device_signature` / `device_nonce`
- `rssi_samples` & `rssi_median`

The backend:
1. Computes current server slot: `current_slot = floor(server_now / 5)`.
2. Checks valid drift slots: `allowed_slots = [current_slot - 1, current_slot, current_slot + 1]`.
3. If `client_time_slot` not in `allowed_slots`, rejects as `STALE_PROOF` or `FUTURE_PROOF`.
4. Derives expected proof using `session_secret`:
   $$\text{expected\_proof} = \text{HMAC-SHA256}(\text{session\_secret}, \text{message})$$
5. Verifies using constant-time comparison `hmac.compare_digest`.
6. Enforces single attendance per `(session_id, student_id)` idempotently.

---

## 4. Proximity & RSSI Policy

1. Student client collects at least 3 RSSI readings within a 3–5 second scan window.
2. Calculates robust sample median:
   $$\text{RSSI}_{\text{median}} = \text{median}([r_1, r_2, \dots, r_n])$$
3. Rejects instantaneous extreme outliers (e.g. RSSI > -20 dBm or < -100 dBm).
4. Submits `{ median: -68, count: 4, min: -72, max: -65 }`.
5. Server policy compares against session threshold (default `-75 dBm`). Attempts below threshold are marked `BELOW_PROXIMITY_THRESHOLD` and logged for diagnostics without recording presence.

---

## 5. Security & Relay Risk Disclosure

- **Live Relay Attack**: A student physically present in the room running a custom sniffer could relay a live 5-second proof over the internet to an absent student.
  - **Mitigations**: 
    1. Short 5-second rotation window.
    2. Device keypair signature: only the authorized registered device can sign the request.
    3. One active registered device per student.
    4. Idempotency and rate limiting.
    5. Anomaly detection on network IP and timestamps.
- **Auditing**: All attempts (successful, stale, below threshold, duplicate) are logged in `attendance_attempts`.
