import { describe, it, expect, vi } from 'vitest';
import { Wallet, type Client } from 'xrpl';
import { issueReputationCredential, ManualKycProvider } from '../../src';

describe('issueReputationCredential — KYC gate (ADR-8)', () => {
  const issuerWallet = Wallet.generate();
  const subjectAddress = Wallet.generate().classicAddress;

  it('refuses to issue when KYC is not approved (never touches the ledger)', async () => {
    const submit = vi.fn();
    const client = { submitAndWait: submit } as unknown as Client;
    const kyc = new ManualKycProvider(); // starts pending
    const { sessionId } = await kyc.startVerification('user-1');

    await expect(
      issueReputationCredential({
        client,
        issuerWallet,
        subjectAddress,
        tier: 'bronze',
        kyc,
        kycSessionId: sessionId,
      }),
    ).rejects.toThrow(/KYC/);
    expect(submit).not.toHaveBeenCalled();
  });

  it('issues once KYC is approved', async () => {
    const submit = vi.fn().mockResolvedValue({ result: { hash: 'TX' } });
    const client = { submitAndWait: submit } as unknown as Client;
    const kyc = new ManualKycProvider();
    const { sessionId } = await kyc.startVerification('user-2');
    kyc.approve(sessionId);

    await issueReputationCredential({
      client,
      issuerWallet,
      subjectAddress,
      tier: 'bronze',
      kyc,
      kycSessionId: sessionId,
    });
    expect(submit).toHaveBeenCalledOnce();
  });
});
