import 'dotenv/config';

/**
 * Ripple Epoch offset in seconds: 2000-01-01T00:00:00Z relative to the Unix epoch.
 * XRPL timestamps are seconds since the Ripple Epoch, NOT Unix (report §2.2).
 *   rippleTime = unixSeconds - RIPPLE_EPOCH_OFFSET
 */
export const RIPPLE_EPOCH_OFFSET = 946_684_800;

/**
 * Margin added AFTER the lease expiry before the escrow's `CancelAfter` is reached
 * (report §2.2). Replaces the fragile 5-day window of v3.0. During this margin a
 * default can still be executed; only afterwards can the escrow be cancelled.
 */
export const CANCEL_MARGIN_DAYS = 30;

/**
 * Governance: on-chain multisignature and human quorum, both 3-of-5 (report §2.3).
 * This belongs to the POOL OPERATOR, not to the project (see docs/decisions.md ADR-3).
 */
export const QUORUM = {
  signerCount: 5,
  threshold: 3,
} as const;

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

export const TIERS: readonly Tier[] = ['bronze', 'silver', 'gold', 'platinum'] as const;

/**
 * Underwriting policy per reputation tier.
 *
 * ⚠️ PLACEHOLDER VALUES — these MUST be calibrated by underwriting with real default
 * data before any mainnet capital (report §1.2, §1.3). They exist only so the PoC has
 * something to enforce; do not treat them as product parameters.
 */
export interface TierPolicy {
  /** Maximum guaranteed amount in XRP for a single aval at this tier. */
  maxAvalXRP: number;
  /** Commission charged to the user, in basis points (100 bps = 1%). */
  commissionBps: number;
}

export const TIER_POLICIES: Record<Tier, TierPolicy> = {
  bronze: { maxAvalXRP: 1_000, commissionBps: 500 },
  silver: { maxAvalXRP: 5_000, commissionBps: 400 },
  gold: { maxAvalXRP: 20_000, commissionBps: 300 },
  platinum: { maxAvalXRP: 100_000, commissionBps: 200 },
};

/**
 * Over-collateralization range vs the fiat-denominated obligation, to absorb XRP
 * volatility in the MVP (report §1.3). Final ratio set by underwriting.
 */
export const OVER_COLLATERALIZATION = {
  minRatio: 1.2,
  maxRatio: 1.4,
} as const;

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Runtime configuration, resolved from the environment (see .env.example). */
export const config = {
  xrpl: {
    wss: readEnv('XRPL_WSS', 'wss://s.altnet.rippletest.net:51233'),
    network: process.env.XRPL_NETWORK ?? 'testnet',
  },
  kms: {
    mode: process.env.KMS_MODE ?? 'mock',
  },
} as const;
