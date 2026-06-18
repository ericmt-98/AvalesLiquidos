import { randomBytes, createHash } from 'node:crypto';

/**
 * PREIMAGE-SHA-256 crypto-conditions for XRPL escrows (report §3.2).
 *
 * Encoding (hex, upper-case):
 *   condition   = A0 25 80 20 <sha256(preimage) 32B> 81 01 20   (suffix 810120 = cost 32)
 *   fulfillment = A0 22 80 20 <preimage 32B>
 *
 * ⚠️ The fulfillment is the secret that releases the escrow. NEVER log it, persist it
 * in cleartext, or return it from an API. It lives encrypted in KMS (report §2.3, §3.3).
 */

const CONDITION_RE = /^A0258020([0-9A-F]{64})810120$/;
const FULFILLMENT_RE = /^A0228020([0-9A-F]{64})$/;

export interface CryptoCondition {
  /** Public condition, embedded in EscrowCreate. */
  condition: string;
  /** Secret preimage fulfillment, presented in EscrowFinish. KEEP ENCRYPTED. */
  fulfillment: string;
}

/** Generate a fresh PREIMAGE-SHA-256 condition/fulfillment pair. */
export function generateCryptoCondition(): CryptoCondition {
  const preimage = randomBytes(32);
  const hash = createHash('sha256').update(preimage).digest();

  const condition = 'A0258020' + hash.toString('hex').toUpperCase() + '810120';
  const fulfillment = 'A0228020' + preimage.toString('hex').toUpperCase();

  return { condition, fulfillment };
}

/**
 * Verify that a fulfillment matches a condition: parse both, then check that
 * sha256(preimage) equals the hash embedded in the condition.
 */
export function verifyFulfillment(condition: string, fulfillment: string): boolean {
  const cond = CONDITION_RE.exec(condition);
  const ful = FULFILLMENT_RE.exec(fulfillment);
  if (!cond || !ful) return false;

  const preimage = Buffer.from(ful[1], 'hex');
  const expectedHash = createHash('sha256').update(preimage).digest('hex').toUpperCase();
  return expectedHash === cond[1];
}
