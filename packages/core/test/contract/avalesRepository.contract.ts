import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AvalesRepository, CreateAvalInput } from '../../src';

/**
 * Shared behavioural contract for any AvalesRepository adapter. Run against both the
 * in-memory and Postgres implementations so they stay equivalent. Every test uses
 * unique ids/addresses, so a shared repo instance needs no truncation between cases.
 */

function sampleInput(over: Partial<CreateAvalInput> = {}): CreateAvalInput {
  const id = randomUUID();
  return {
    id,
    escrowOwner: `rPool_${randomUUID().slice(0, 8)}`,
    escrowSequence: Math.floor(Math.random() * 1_000_000_000),
    userAddress: `rUser_${randomUUID().slice(0, 8)}`,
    beneficiaryAddress: `rBen_${randomUUID().slice(0, 8)}`,
    amountXRP: 1000,
    vencimiento: new Date('2027-01-01T00:00:00Z'),
    cancelAfter: 900_000_000,
    condition: `A0258020${'AB'.repeat(32)}810120`,
    fulfillmentRef: `kms-mock:${id}`,
    contractHash: 'DEADBEEF',
    ...over,
  };
}

export function avalesRepositoryContract(getRepo: () => AvalesRepository): void {
  it('creates and reads back by id, defaulting estado to activo', async () => {
    const repo = getRepo();
    const input = sampleInput();
    const created = await repo.create(input);
    expect(created.id).toBe(input.id);
    expect(created.estado).toBe('activo');
    expect(created.amountXRP).toBe(input.amountXRP);
    expect(created.cancelAfter).toBe(input.cancelAfter);

    const found = await repo.findById(input.id);
    expect(found?.beneficiaryAddress).toBe(input.beneficiaryAddress);
  });

  it('returns null for a missing id', async () => {
    expect(await getRepo().findById(randomUUID())).toBeNull();
  });

  it('finds by escrow owner + sequence (reconciliation §4)', async () => {
    const repo = getRepo();
    const input = sampleInput();
    await repo.create(input);
    const found = await repo.findByEscrow(input.escrowOwner, input.escrowSequence);
    expect(found?.id).toBe(input.id);
    expect(await repo.findByEscrow(input.escrowOwner, input.escrowSequence + 1)).toBeNull();
  });

  it('updates estado and outcome fields', async () => {
    const repo = getRepo();
    const input = sampleInput();
    await repo.create(input);
    const updated = await repo.update(input.id, {
      estado: 'ejecutado',
      fechaEjecucion: new Date(),
      txEjecucion: 'TXHASH123',
      quorumRecord: 'quorum-record:1',
    });
    expect(updated.estado).toBe('ejecutado');
    expect(updated.txEjecucion).toBe('TXHASH123');
    expect(updated.quorumRecord).toBe('quorum-record:1');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(updated.createdAt.getTime());
  });

  it('lists by beneficiary and by estado', async () => {
    const repo = getRepo();
    const ben = `rBenUniq_${randomUUID().slice(0, 8)}`;
    const a = sampleInput({ beneficiaryAddress: ben });
    const b = sampleInput({ beneficiaryAddress: ben });
    await repo.create(a);
    await repo.create(b);

    const list = await repo.findByBeneficiary(ben);
    expect(list.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());

    await repo.update(a.id, { estado: 'cumplido', fechaCumplimiento: new Date(), txCumplimiento: 'TX' });
    const cumplidos = await repo.findByEstado('cumplido');
    expect(cumplidos.map((r) => r.id)).toContain(a.id);
  });

  it('rejects throwing on update of a missing id', async () => {
    await expect(getRepo().update(randomUUID(), { estado: 'expirado' })).rejects.toThrow();
  });

  it('nextDestinationTag is unique, increasing, and within uint32 (§3.3)', async () => {
    const repo = getRepo();
    const t1 = await repo.nextDestinationTag();
    const t2 = await repo.nextDestinationTag();
    expect(t1).toBeGreaterThan(0);
    expect(t2).toBeGreaterThan(t1);
    expect(t2).toBeLessThanOrEqual(4_294_967_295);
  });
}
