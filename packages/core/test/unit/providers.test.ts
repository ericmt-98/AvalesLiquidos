import { describe, it, expect } from 'vitest';
import {
  MockKmsProvider,
  MockQuorumProvider,
  ManualKycProvider,
  generateCryptoCondition,
} from '../../src';

describe('KMS + Quorum gating (report §2.3, §3.5)', () => {
  it('stores only a reference, not the secret', async () => {
    const kms = new MockKmsProvider();
    const { fulfillment } = generateCryptoCondition();
    const ref = await kms.encryptAndStore('aval-1', fulfillment);

    expect(ref).not.toBe(fulfillment);
    expect(ref).not.toContain(fulfillment);
  });

  it('releases the secret only with a token the quorum granted', async () => {
    const quorum = new MockQuorumProvider(true);
    const kms = new MockKmsProvider((token) => quorum.grantedTokens.has(token));
    const { fulfillment } = generateCryptoCondition();
    const ref = await kms.encryptAndStore('aval-1', fulfillment);

    const approval = await quorum.requireApproval('aval-1', 'default_execution');
    expect(approval.granted).toBe(true);
    expect(approval.recordId).not.toBe('');

    await expect(kms.decrypt(ref, approval.token)).resolves.toBe(fulfillment);
  });

  it('refuses to decrypt without a valid quorum token', async () => {
    const quorum = new MockQuorumProvider(true);
    const kms = new MockKmsProvider((token) => quorum.grantedTokens.has(token));
    const ref = await kms.encryptAndStore('aval-1', 'secret');

    await expect(kms.decrypt(ref, '')).rejects.toThrow(/quorum authorization/);
    await expect(kms.decrypt(ref, 'forged-token')).rejects.toThrow(/quorum authorization/);
  });

  it('does not grant when quorum is not reached', async () => {
    const quorum = new MockQuorumProvider(false);
    const approval = await quorum.requireApproval('aval-1', 'default_execution');
    expect(approval.granted).toBe(false);
    expect(approval.token).toBe('');
  });
});

describe('KYC port (arquitectura §12, ADR-8)', () => {
  it('starts pending and can be approved manually', async () => {
    const kyc = new ManualKycProvider();
    const { sessionId, status } = await kyc.startVerification('user-1');
    expect(status).toBe('pending');

    kyc.approve(sessionId);
    await expect(kyc.getStatus(sessionId)).resolves.toBe('approved');
  });

  it('reports rejected for unknown sessions', async () => {
    const kyc = new ManualKycProvider();
    await expect(kyc.getStatus('nope')).resolves.toBe('rejected');
  });
});
