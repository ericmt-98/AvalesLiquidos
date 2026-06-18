import { isoTimeToRippleTime } from 'xrpl';
import { RIPPLE_EPOCH_OFFSET } from '../config';

/**
 * XRPL uses the Ripple Epoch (seconds since 2000-01-01T00:00:00Z), never Unix time
 * (report §2.2). Always go through these helpers when building escrow timestamps.
 */

/** Current time as a Ripple Epoch timestamp. */
export function nowRippleTime(): number {
  return isoTimeToRippleTime(new Date().toISOString());
}

/** Convert a JS Date (or ISO-8601 string) to a Ripple Epoch timestamp. */
export function toRippleTime(when: Date | string): number {
  const iso = typeof when === 'string' ? when : when.toISOString();
  return isoTimeToRippleTime(iso);
}

/** Ripple Epoch timestamp `days` from `from` (default: now). */
export function rippleTimeInDays(days: number, from: Date = new Date()): number {
  return toRippleTime(new Date(from.getTime() + days * 86_400 * 1_000));
}

/**
 * Convert Unix seconds to Ripple Epoch seconds. Exposed mainly to make the offset
 * relationship explicit and testable (report §2.2).
 */
export function unixToRipple(unixSeconds: number): number {
  return unixSeconds - RIPPLE_EPOCH_OFFSET;
}
