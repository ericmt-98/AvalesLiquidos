import { TIERS, type Tier } from '../config';

/**
 * Reputation tiers as XLS-70 CredentialType values (report §2.4).
 *
 * The on-chain CredentialType is the hex of the ASCII string `REPUTACION_<TIER>`.
 * Change #3 in the report: the value must NOT contain a literal underscore byte error.
 * Reference: REPUTACION_SILVER = 52455055544143494F4E5F53494C564552.
 */

export function credentialTypeString(tier: Tier): string {
  return `REPUTACION_${tier.toUpperCase()}`;
}

export function credentialTypeHex(tier: Tier): string {
  return Buffer.from(credentialTypeString(tier), 'utf8').toString('hex').toUpperCase();
}

const TYPE_RE = /^REPUTACION_(BRONZE|SILVER|GOLD|PLATINUM)$/;

/** Decode a hex CredentialType back to a Tier, or null if it isn't one of ours. */
export function parseCredentialTypeHex(hex: string): Tier | null {
  if (!/^[0-9A-Fa-f]*$/.test(hex) || hex.length % 2 !== 0) return null;
  const decoded = Buffer.from(hex, 'hex').toString('utf8');
  const match = TYPE_RE.exec(decoded);
  return match ? (match[1].toLowerCase() as Tier) : null;
}

/** Tier one step up (capped at the top tier). */
export function tierUp(tier: Tier): Tier {
  const i = TIERS.indexOf(tier);
  return TIERS[Math.min(i + 1, TIERS.length - 1)];
}

/** Tier one step down (floored at the bottom tier). */
export function tierDown(tier: Tier): Tier {
  const i = TIERS.indexOf(tier);
  return TIERS[Math.max(i - 1, 0)];
}
