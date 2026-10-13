import { test } from 'node:test';
import assert from 'node:assert';
import {
  calculateTimeSlot,
  generateProof,
  verifyProof,
  buildProofMessage,
  PROTOCOL_VERSION,
} from '../src/ble/proof';

test('calculateTimeSlot rounds epoch ms to 5-second boundary', () => {
  const t1 = 1700000000 * 1000;
  const slot1 = calculateTimeSlot(t1);
  assert.strictEqual(slot1, 340000000);

  const t2 = (1700000000 + 4) * 1000;
  const slot2 = calculateTimeSlot(t2);
  assert.strictEqual(slot2, slot1);

  const t3 = (1700000000 + 5) * 1000;
  const slot3 = calculateTimeSlot(t3);
  assert.strictEqual(slot3, slot1 + 1);
});

test('buildProofMessage generates 21 canonical bytes', () => {
  const sessionId = 'd3b07384-d113-467a-9a91-4cf1534b12aa';
  const slot = 340000000;
  const msg = buildProofMessage(sessionId, slot, PROTOCOL_VERSION);
  assert.strictEqual(msg.length, 21);
  assert.strictEqual(msg[0], 1);
});

test('generateProof produces deterministic 32-character hex token', async () => {
  const secret = 'test-secret-key-1234567890abcdef1234567890abcdef';
  const sessionId = 'd3b07384-d113-467a-9a91-4cf1534b12aa';
  const slot = 100000;

  const proof1 = await generateProof(secret, sessionId, slot);
  const proof2 = await generateProof(secret, sessionId, slot);

  assert.strictEqual(proof1.length, 32);
  assert.strictEqual(proof1, proof2);

  // Different slot produces different proof
  const proofOtherSlot = await generateProof(secret, sessionId, slot + 1);
  assert.notStrictEqual(proof1, proofOtherSlot);
});

test('verifyProof verifies fresh proofs and rejects invalid proofs', async () => {
  const secret = 'super-secret-hex-key';
  const sessionId = 'd3b07384-d113-467a-9a91-4cf1534b12aa';
  const slot = 500000;

  const validProof = await generateProof(secret, sessionId, slot);

  // Valid proof matches
  assert.strictEqual(
    await verifyProof(validProof, secret, sessionId, slot),
    true
  );

  // Wrong slot fails
  assert.strictEqual(
    await verifyProof(validProof, secret, sessionId, slot + 1),
    false
  );

  // Tampered proof fails
  const tampered = validProof.slice(0, -2) + '00';
  assert.strictEqual(
    await verifyProof(tampered, secret, sessionId, slot),
    false
  );
});
