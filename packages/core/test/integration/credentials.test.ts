import { describe, it, expect } from 'vitest';
import { withClient, issueCredential, acceptCredential, changeTier, getValidTier } from '../../src';

/**
 * Integration (testnet): full XLS-70 credential lifecycle (report §3.7).
 * Proves change #7 / "in transit → null": a deleted-but-not-yet-accepted tier yields null.
 */
describe('credential lifecycle (integration · testnet)', () => {
  it('issue → accept → change tier, returning null while in transit', async () => {
    await withClient(async (client) => {
      const issuer = (await client.fundWallet()).wallet;
      const subject = (await client.fundWallet()).wallet;
      const issuerAddr = issuer.classicAddress;
      const subjectAddr = subject.classicAddress;

      // 1. Issued but not accepted → null.
      await issueCredential({ client, issuerWallet: issuer, subjectAddress: subjectAddr, tier: 'bronze' });
      expect(await getValidTier(client, issuerAddr, subjectAddr)).toBeNull();

      // 2. Accepted → bronze.
      await acceptCredential({ client, subjectWallet: subject, issuerAddress: issuerAddr, tier: 'bronze' });
      expect(await getValidTier(client, issuerAddr, subjectAddr)).toBe('bronze');

      // 3. Change to silver (delete bronze + create silver); not accepted → null.
      await changeTier({ client, issuerWallet: issuer, subjectAddress: subjectAddr, fromTier: 'bronze', toTier: 'silver' });
      expect(await getValidTier(client, issuerAddr, subjectAddr)).toBeNull();

      // 4. Accept silver → silver.
      await acceptCredential({ client, subjectWallet: subject, issuerAddress: issuerAddr, tier: 'silver' });
      expect(await getValidTier(client, issuerAddr, subjectAddr)).toBe('silver');
    });
  }, 180_000);
});
