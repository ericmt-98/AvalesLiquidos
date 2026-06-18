import { describe, it, expect, vi } from 'vitest';
import { Wallet, type Client } from 'xrpl';
import { randomUUID } from 'node:crypto';
import {
  enforceTierLimits,
  createAval,
  executeDefault,
  markAsCompleted,
  InMemoryAvalesRepository,
  MockKmsProvider,
  MockQuorumProvider,
  nowRippleTime,
  type CreateAvalInput,
} from '../../src';

function avalInput(over: Partial<CreateAvalInput> = {}): CreateAvalInput {
  const id = randomUUID();
  return {
    id,
    escrowOwner: 'rPool',
    escrowSequence: 42,
    userAddress: 'rUser',
    beneficiaryAddress: 'rBen',
    amountXRP: 5,
    vencimiento: new Date(),
    cancelAfter: nowRippleTime() + 1_000,
    condition: `A0258020${'AB'.repeat(32)}810120`,
    fulfillmentRef: `kms-mock:${id}`,
    contractHash: 'AA',
    ...over,
  };
}

describe('enforceTierLimits (§3.3)', () => {
  it('passes within the tier limit', () => {
    expect(() => enforceTierLimits('bronze', 500)).not.toThrow();
  });
  it('rejects amounts over the tier limit', () => {
    expect(() => enforceTierLimits('bronze', 100_000)).toThrow(/exceeds/);
  });
  it('rejects non-positive amounts', () => {
    expect(() => enforceTierLimits('gold', 0)).toThrow(/positive/);
  });
});

describe('createAval — guards (no network)', () => {
  it('refuses when the user has no valid credential', async () => {
    const request = vi.fn().mockResolvedValue({ result: { account_objects: [] } });
    const client = { request } as unknown as Client;
    await expect(
      createAval({
        client,
        repo: new InMemoryAvalesRepository(),
        kms: new MockKmsProvider(),
        poolAddress: 'rPool',
        signerWallets: [],
        userAddress: 'rUser',
        beneficiaryAddress: 'rBen',
        amountXRP: 5,
        durationDays: 30,
        contractHash: 'AA',
        avalId: randomUUID(),
      }),
    ).rejects.toThrow(/credential/i);
  });
});

describe('executeDefault — orchestration (mocked client)', () => {
  it('requires quorum before touching the ledger', async () => {
    const repo = new InMemoryAvalesRepository();
    const input = avalInput();
    await repo.create(input);
    const submit = vi.fn();
    const client = { submitAndWait: submit } as unknown as Client;

    await expect(
      executeDefault({
        client,
        repo,
        kms: new MockKmsProvider(),
        quorum: new MockQuorumProvider(false), // denies
        executorWallet: Wallet.generate(),
        avalId: input.id,
      }),
    ).rejects.toThrow(/Quorum/);
    expect(submit).not.toHaveBeenCalled();
  });

  it('decrypts via quorum token and finishes, marking the aval executed', async () => {
    const repo = new InMemoryAvalesRepository();
    const quorum = new MockQuorumProvider(true);
    const kms = new MockKmsProvider((t) => quorum.grantedTokens.has(t));
    const id = randomUUID();
    const ref = await kms.encryptAndStore(id, `A0228020${'00'.repeat(32)}`);
    await repo.create(avalInput({ id, fulfillmentRef: ref }));

    const submit = vi.fn().mockResolvedValue({ result: { hash: 'TXF' } });
    const client = { submitAndWait: submit } as unknown as Client;
    const onExecuted = vi.fn().mockResolvedValue(undefined);

    const res = await executeDefault({
      client, repo, kms, quorum, executorWallet: Wallet.generate(), avalId: id, onExecuted,
    });
    expect(res.txHash).toBe('TXF');
    expect((await repo.findById(id))?.estado).toBe('ejecutado');
    expect((await repo.findById(id))?.quorumRecord).toMatch(/quorum-record/);
    expect(onExecuted).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
  });
});

describe('markAsCompleted — cancel_after guard (change #4, mocked client)', () => {
  it('rejects EscrowCancel before cancel_after', async () => {
    const repo = new InMemoryAvalesRepository();
    const input = avalInput({ cancelAfter: nowRippleTime() + 100_000 });
    await repo.create(input);
    const submit = vi.fn();
    const client = { submitAndWait: submit } as unknown as Client;

    await expect(
      markAsCompleted({ client, repo, executorWallet: Wallet.generate(), avalId: input.id }),
    ).rejects.toThrow(/CancelAfter/);
    expect(submit).not.toHaveBeenCalled();
  });

  it('cancels after cancel_after and marks the aval completed', async () => {
    const repo = new InMemoryAvalesRepository();
    const input = avalInput({ cancelAfter: nowRippleTime() - 100 });
    await repo.create(input);
    const submit = vi.fn().mockResolvedValue({ result: { hash: 'TXC' } });
    const client = { submitAndWait: submit } as unknown as Client;
    const onCompleted = vi.fn().mockResolvedValue(undefined);

    await markAsCompleted({ client, repo, executorWallet: Wallet.generate(), avalId: input.id, onCompleted });
    expect((await repo.findById(input.id))?.estado).toBe('cumplido');
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
  });
});
