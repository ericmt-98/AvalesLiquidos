import { describe, it, expect } from 'vitest';
import {
  CANCEL_MARGIN_DAYS,
  QUORUM,
  TIERS,
  TIER_POLICIES,
  OVER_COLLATERALIZATION,
  config,
} from '../../src';

describe('config constants', () => {
  it('cancel margin is 30 days (report §2.2, replaces the 5-day window)', () => {
    expect(CANCEL_MARGIN_DAYS).toBe(30);
  });

  it('quorum is 3-of-5 (report §2.3)', () => {
    expect(QUORUM.threshold).toBe(3);
    expect(QUORUM.signerCount).toBe(5);
    expect(QUORUM.threshold).toBeLessThan(QUORUM.signerCount);
  });

  it('defines exactly the four reputation tiers', () => {
    expect(TIERS).toEqual(['bronze', 'silver', 'gold', 'platinum']);
    for (const tier of TIERS) {
      expect(TIER_POLICIES[tier].maxAvalXRP).toBeGreaterThan(0);
      expect(TIER_POLICIES[tier].commissionBps).toBeGreaterThan(0);
    }
  });

  it('higher tiers allow larger avales and charge less commission', () => {
    expect(TIER_POLICIES.platinum.maxAvalXRP).toBeGreaterThan(TIER_POLICIES.bronze.maxAvalXRP);
    expect(TIER_POLICIES.platinum.commissionBps).toBeLessThan(TIER_POLICIES.bronze.commissionBps);
  });

  it('over-collateralization range is sane (report §1.3)', () => {
    expect(OVER_COLLATERALIZATION.minRatio).toBeGreaterThanOrEqual(1);
    expect(OVER_COLLATERALIZATION.maxRatio).toBeGreaterThan(OVER_COLLATERALIZATION.minRatio);
  });

  it('defaults to testnet when no env override is present', () => {
    expect(config.xrpl.wss).toContain('rippletest.net');
    expect(config.kms.mode).toBe('mock');
  });
});
