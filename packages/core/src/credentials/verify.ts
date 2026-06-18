import { Client } from 'xrpl';
import { nowRippleTime } from '../xrpl/time';
import { parseCredentialTypeHex } from './tiers';
import type { Tier } from '../config';

/** lsfAccepted: the credential has been accepted by the subject (report §3.4). */
export const lsfAccepted = 0x00010000;

/** Minimal shape of a Credential ledger entry we care about. */
export interface CredentialLike {
  LedgerEntryType?: string;
  Issuer?: string;
  Flags?: number;
  Expiration?: number;
  CredentialType?: string;
}

/**
 * Pure selection logic for the COMPLETE credential check (report §3.4, change #7):
 * correct issuer + accepted (lsfAccepted) + not expired + a recognized tier.
 * Returns the first valid tier, or null. Exposed for unit testing.
 */
export function selectValidTier(
  objects: CredentialLike[],
  issuerAddress: string,
  nowRipple: number,
): Tier | null {
  for (const cred of objects) {
    if (cred.LedgerEntryType && cred.LedgerEntryType !== 'Credential') continue;
    if (cred.Issuer !== issuerAddress) continue; // correct issuer
    if (!((cred.Flags ?? 0) & lsfAccepted)) continue; // accepted by the user
    if (cred.Expiration !== undefined && cred.Expiration <= nowRipple) continue; // still valid
    if (!cred.CredentialType) continue;
    const tier = parseCredentialTypeHex(cred.CredentialType);
    if (tier) return tier;
  }
  return null;
}

/**
 * Fetch the user's credentials and return their valid reputation tier, or null
 * (report §3.4). A user mid-tier-change (deleted, new one not yet accepted) yields null.
 */
export async function getValidTier(
  client: Client,
  issuerAddress: string,
  userAddress: string,
): Promise<Tier | null> {
  const { result } = await client.request({
    command: 'account_objects',
    account: userAddress,
    type: 'credential',
  });
  return selectValidTier(
    result.account_objects as unknown as CredentialLike[],
    issuerAddress,
    nowRippleTime(),
  );
}
