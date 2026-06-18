import { describe, it, expect } from 'vitest';
import { generateCryptoCondition, verifyFulfillment } from '../../src';

describe('crypto-condition PREIMAGE-SHA-256 (report §3.2)', () => {
  it('generates a condition with the correct shape and 810120 suffix', () => {
    const { condition } = generateCryptoCondition();
    expect(condition).toMatch(/^A0258020[0-9A-F]{64}810120$/);
  });

  it('generates a fulfillment with the correct shape', () => {
    const { fulfillment } = generateCryptoCondition();
    expect(fulfillment).toMatch(/^A0228020[0-9A-F]{64}$/);
  });

  it('the fulfillment validates against its condition', () => {
    const { condition, fulfillment } = generateCryptoCondition();
    expect(verifyFulfillment(condition, fulfillment)).toBe(true);
  });

  it('a fulfillment does NOT validate against a different condition', () => {
    const a = generateCryptoCondition();
    const b = generateCryptoCondition();
    expect(verifyFulfillment(a.condition, b.fulfillment)).toBe(false);
  });

  it('rejects malformed inputs', () => {
    const { condition, fulfillment } = generateCryptoCondition();
    expect(verifyFulfillment('not-a-condition', fulfillment)).toBe(false);
    expect(verifyFulfillment(condition, 'not-a-fulfillment')).toBe(false);
  });

  it('produces unique pairs', () => {
    const a = generateCryptoCondition();
    const b = generateCryptoCondition();
    expect(a.condition).not.toBe(b.condition);
    expect(a.fulfillment).not.toBe(b.fulfillment);
  });
});
