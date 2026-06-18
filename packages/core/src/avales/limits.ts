import { TIER_POLICIES, type Tier } from '../config';

/**
 * Enforce the per-tier guarantee limit (report §3.3 enforceTierLimits, §2.4).
 * Limits are placeholder underwriting values (config.ts) — calibrate before mainnet.
 */
export function enforceTierLimits(tier: Tier, amountXRP: number): void {
  if (!(amountXRP > 0)) {
    throw new Error('amountXRP must be positive');
  }
  const max = TIER_POLICIES[tier].maxAvalXRP;
  if (amountXRP > max) {
    throw new Error(`Amount ${amountXRP} XRP exceeds the ${tier} tier limit of ${max} XRP`);
  }
}
