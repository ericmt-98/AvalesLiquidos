import { describe, it, expect } from 'vitest';
import {
  RIPPLE_EPOCH_OFFSET,
  toRippleTime,
  unixToRipple,
  rippleTimeInDays,
} from '../../src';

describe('ripple time helpers', () => {
  it('uses the correct Ripple Epoch offset (report §2.2)', () => {
    expect(RIPPLE_EPOCH_OFFSET).toBe(946_684_800);
  });

  it('rippleTime = unixSeconds − 946684800', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const unixSeconds = Math.floor(date.getTime() / 1_000);

    expect(toRippleTime(date)).toBe(unixSeconds - RIPPLE_EPOCH_OFFSET);
    expect(unixToRipple(unixSeconds)).toBe(toRippleTime(date));
  });

  it('accepts an ISO string and a Date equivalently', () => {
    const iso = '2026-06-18T12:00:00Z';
    expect(toRippleTime(iso)).toBe(toRippleTime(new Date(iso)));
  });

  it('adds whole days correctly', () => {
    const from = new Date('2026-06-18T00:00:00Z');
    const expected = toRippleTime(from) + 30 * 86_400;
    expect(rippleTimeInDays(30, from)).toBe(expected);
  });
});
