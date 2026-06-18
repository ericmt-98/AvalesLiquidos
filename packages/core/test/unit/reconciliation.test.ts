import { describe, it, expect, vi } from 'vitest';
import { type Client } from 'xrpl';
import { randomUUID } from 'node:crypto';
import {
  handleEscrowTransaction,
  reconcileState,
  InMemoryAvalesRepository,
  nowRippleTime,
  type CreateAvalInput,
} from '../../src';

function activoAval(over: Partial<CreateAvalInput> = {}): CreateAvalInput {
  const id = randomUUID();
  return {
    id,
    escrowOwner: 'rPool',
    escrowSequence: 100 + Math.floor(Math.random() * 1_000_000),
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

describe('handleEscrowTransaction (§4, evidence asymmetry §2.1)', () => {
  it('marks an activo aval ejecutado on EscrowFinish', async () => {
    const repo = new InMemoryAvalesRepository();
    const input = activoAval();
    await repo.create(input);
    const changed = await handleEscrowTransaction(repo, input.escrowOwner, input.escrowSequence, 'EscrowFinish', 'TXF');
    expect(changed).toBe(true);
    const aval = await repo.findById(input.id);
    expect(aval?.estado).toBe('ejecutado');
    expect(aval?.txEjecucion).toBe('TXF');
  });

  it('marks an activo aval cumplido on EscrowCancel', async () => {
    const repo = new InMemoryAvalesRepository();
    const input = activoAval();
    await repo.create(input);
    await handleEscrowTransaction(repo, input.escrowOwner, input.escrowSequence, 'EscrowCancel', 'TXC');
    expect((await repo.findById(input.id))?.estado).toBe('cumplido');
  });

  it('does not overwrite an already-resolved aval (preserves the reason)', async () => {
    const repo = new InMemoryAvalesRepository();
    const input = activoAval();
    await repo.create(input);
    await repo.update(input.id, { estado: 'ejecutado', txEjecucion: 'ORIGINAL' });
    const changed = await handleEscrowTransaction(repo, input.escrowOwner, input.escrowSequence, 'EscrowCancel', 'TXC');
    expect(changed).toBe(false);
    expect((await repo.findById(input.id))?.txEjecucion).toBe('ORIGINAL');
  });

  it('ignores escrows it does not own', async () => {
    const repo = new InMemoryAvalesRepository();
    expect(await handleEscrowTransaction(repo, 'rPool', 999, 'EscrowFinish')).toBe(false);
  });
});

describe('reconcileState — periodic safety net (§4)', () => {
  it('reconciles an activo aval whose escrow is gone, via account history', async () => {
    const repo = new InMemoryAvalesRepository();
    const input = activoAval();
    await repo.create(input);

    const request = vi.fn(async (req: { command: string }) => {
      if (req.command === 'ledger_entry') throw new Error('entryNotFound');
      if (req.command === 'account_tx') {
        return {
          result: {
            transactions: [
              {
                hash: 'TXF',
                tx_json: {
                  TransactionType: 'EscrowFinish',
                  Owner: input.escrowOwner,
                  OfferSequence: input.escrowSequence,
                },
              },
            ],
          },
        };
      }
      throw new Error(`unexpected command ${req.command}`);
    });
    const client = { request } as unknown as Client;

    const count = await reconcileState(client, repo);
    expect(count).toBe(1);
    expect((await repo.findById(input.id))?.estado).toBe('ejecutado');
    expect((await repo.findById(input.id))?.txEjecucion).toBe('TXF');
  });

  it('leaves an aval whose escrow still exists untouched', async () => {
    const repo = new InMemoryAvalesRepository();
    const input = activoAval();
    await repo.create(input);

    const request = vi.fn(async (req: { command: string }) => {
      if (req.command === 'ledger_entry') return { result: {} };
      throw new Error(`unexpected command ${req.command}`);
    });
    const client = { request } as unknown as Client;

    const count = await reconcileState(client, repo);
    expect(count).toBe(0);
    expect((await repo.findById(input.id))?.estado).toBe('activo');
  });
});
