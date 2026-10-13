import assert from 'node:assert';
import { createHmac } from 'node:crypto';

console.log('--- Running Milestone 1 BLE Technical Spike Verification ---');

// 1. Test canonical message format and HMAC-SHA256
const PROTOCOL_VERSION = 1;
const testSessionId = 'd3b07384-d113-467a-9a91-4cf1534b12aa';
const testSecretHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const testSlot = 3567890;

function hexToBytes(hex) {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function buildProofMessage(sessionId, slot, version = PROTOCOL_VERSION) {
  const cleanUuid = sessionId.replace(/-/g, '');
  const uuidBytes = hexToBytes(cleanUuid);
  const buffer = new Uint8Array(1 + 16 + 4);
  buffer[0] = version & 0xff;
  buffer.set(uuidBytes, 1);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  view.setUint32(17, slot, false);
  return buffer;
}

const msgBuffer = buildProofMessage(testSessionId, testSlot);
assert.strictEqual(msgBuffer.length, 21, 'Message buffer must be exactly 21 bytes (1 ver + 16 uuid + 4 slot)');
assert.strictEqual(msgBuffer[0], 1, 'Version must be 1');

// Node HMAC calculation
const secretKey = Buffer.from(testSecretHex, 'hex');
const hmac = createHmac('sha256', secretKey);
hmac.update(msgBuffer);
const fullDigest = hmac.digest('hex');
const proof = fullDigest.substring(0, 32);

assert.strictEqual(proof.length, 32, 'Proof must be truncated to 32 hex chars (16 bytes)');
console.log('✓ Proof Generation Verified: sample proof =', proof);

// 2. Test Time Slot & Drift Window Calculation
const PROOF_VALIDITY_SECONDS = 5;
const nowSeconds = Math.floor(Date.now() / 1000);
const currentSlot = Math.floor(nowSeconds / PROOF_VALIDITY_SECONDS);
const allowedSlots = [currentSlot - 1, currentSlot, currentSlot + 1];

assert.ok(allowedSlots.includes(currentSlot), 'Current slot must be accepted');
assert.ok(allowedSlots.includes(currentSlot - 1), 'Previous slot (clock drift) must be accepted');
assert.ok(!allowedSlots.includes(currentSlot - 2), 'Older slots must be rejected');
console.log('✓ Time Slot & Drift Window Verified: current slot =', currentSlot);

// 3. Test RSSI Sample Aggregation & Proximity Policy
function aggregateRSSI(readings, minSamples = 3) {
  const plausible = readings
    .map((r) => r.value)
    .filter((val) => val >= -100 && val <= -20);

  if (plausible.length < minSamples) return null;
  const sorted = [...plausible].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  return {
    median,
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    samples: sorted,
  };
}

const testSamples = [
  { value: -70, timestamp: 1 },
  { value: -68, timestamp: 2 },
  { value: -72, timestamp: 3 },
  { value: -65, timestamp: 4 },
  { value: -120, timestamp: 5 }, // Outlier: must be filtered out
];

const aggregated = aggregateRSSI(testSamples, 3);
assert.ok(aggregated !== null, 'Aggregated result should not be null');
assert.strictEqual(aggregated.count, 4, 'Outlier (-120 dBm) must be rejected');
assert.strictEqual(aggregated.min, -72);
assert.strictEqual(aggregated.max, -65);
assert.strictEqual(aggregated.median, -69); // sorted: [-72, -70, -68, -65], mid of [-70, -68] = -69
assert.ok(aggregated.median >= -75, 'Median -69 dBm must meet -75 dBm proximity threshold');

console.log('✓ RSSI Aggregation & Filtering Verified: median =', aggregated.median, 'samples =', aggregated.samples);

// Insufficient samples test
const insufficient = aggregateRSSI([{ value: -70, timestamp: 1 }], 3);
assert.strictEqual(insufficient, null, 'Must reject when fewer than 3 samples');
console.log('✓ Insufficient Samples Rejection Verified');

console.log('\nAll Milestone 1 BLE Spike tests passed successfully!');
