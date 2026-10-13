export const PROTOCOL_VERSION = 1;
export const DEFAULT_PROOF_VALIDITY_SECONDS = 5;

/**
 * Calculates current time slot based on slot duration (default 5s).
 */
export function calculateTimeSlot(
  timestampMs: number = Date.now(),
  slotDurationSeconds: number = DEFAULT_PROOF_VALIDITY_SECONDS
): number {
  return Math.floor(timestampMs / 1000 / slotDurationSeconds);
}

/**
 * Converts a hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Converts Uint8Array to hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const buf = await globalThis.crypto.subtle.digest(
      'SHA-256',
      data as unknown as BufferSource
    );
    return new Uint8Array(buf);
  }
  const Crypto = await import('expo-crypto');
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytesToHex(data),
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hexToBytes(hex);
}

/**
 * RFC 2104 compliant HMAC-SHA256 calculation.
 * Uses WebCrypto SubtleCrypto if available, or falls back to RFC 2104 block padding with SHA-256.
 */
export async function computeHmacSha256(
  keyHex: string,
  messageBytes: Uint8Array
): Promise<string> {
  const keyBytes = hexToBytes(keyHex);

  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    try {
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        keyBytes as unknown as BufferSource,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await globalThis.crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageBytes as unknown as BufferSource
      );
      return bytesToHex(new Uint8Array(signature));
    } catch {
      // Fallback to manual HMAC implementation below
    }
  }

  // Pure RFC 2104 implementation using SHA-256
  const blockSize = 64; // SHA-256 block size is 64 bytes
  let k = new Uint8Array(blockSize);

  if (keyBytes.length > blockSize) {
    const keyHashBytes = await sha256Bytes(keyBytes);
    k.set(keyHashBytes);
  } else {
    k.set(keyBytes);
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);

  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = k[i] ^ 0x5c;
    iKeyPad[i] = k[i] ^ 0x36;
  }

  // Inner hash: H(iKeyPad || message)
  const innerConcat = new Uint8Array(blockSize + messageBytes.length);
  innerConcat.set(iKeyPad, 0);
  innerConcat.set(messageBytes, blockSize);

  const innerHashBytes = await sha256Bytes(innerConcat);

  // Outer hash: H(oKeyPad || innerHash)
  const outerConcat = new Uint8Array(blockSize + innerHashBytes.length);
  outerConcat.set(oKeyPad, 0);
  outerConcat.set(innerHashBytes, blockSize);

  const outerHashBytes = await sha256Bytes(outerConcat);
  return bytesToHex(outerHashBytes);
}

/**
 * Builds the canonical message payload:
 * [protocolVersion (1 byte)] || [sessionId (16 raw bytes)] || [slot (4 bytes BE)]
 */
export function buildProofMessage(
  sessionId: string,
  timeSlot: number,
  protocolVersion: number = PROTOCOL_VERSION
): Uint8Array {
  // Normalize UUID by removing hyphens
  const cleanUuid = sessionId.replace(/-/g, '');
  const uuidBytes = hexToBytes(cleanUuid);

  const buffer = new Uint8Array(1 + 16 + 4);
  buffer[0] = protocolVersion & 0xff;
  buffer.set(uuidBytes, 1);

  // Big-endian 32-bit timeSlot
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  view.setUint32(17, timeSlot, false);

  return buffer;
}

/**
 * Generates the rotating proof for a given session, slot, and secret.
 * Returns the truncated 32-hex-char (16-byte) token as specified in PRD.
 */
export async function generateProof(
  sessionSecretHex: string,
  sessionId: string,
  timeSlot: number,
  protocolVersion: number = PROTOCOL_VERSION
): Promise<string> {
  const message = buildProofMessage(sessionId, timeSlot, protocolVersion);
  const fullHmac = await computeHmacSha256(sessionSecretHex, message);
  return fullHmac.substring(0, 32); // 16 bytes / 32 hex chars
}

/**
 * Validates whether a proof matches the expected secret and slot.
 */
export async function verifyProof(
  candidateProof: string,
  sessionSecretHex: string,
  sessionId: string,
  timeSlot: number,
  protocolVersion: number = PROTOCOL_VERSION
): Promise<boolean> {
  const expected = await generateProof(
    sessionSecretHex,
    sessionId,
    timeSlot,
    protocolVersion
  );
  return candidateProof.toLowerCase() === expected.toLowerCase();
}
