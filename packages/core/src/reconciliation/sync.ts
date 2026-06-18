import type { AvalesRepository } from '../db/repository';

export type EscrowResolutionTx = 'EscrowFinish' | 'EscrowCancel';

/**
 * Reconcile an aval's state from an observed on-chain escrow resolution.
 *
 * Only updates an aval still in 'activo' — it NEVER overwrites a state we already
 * recorded. This respects the evidence asymmetry (§2.1): EscrowFinish/Cancel prove
 * the on-chain *fact*, but the *reason* lives in the DB + quorum record. If we already
 * resolved it (with its reason), the listener/sweep must not clobber it.
 *
 * Returns true if it changed the aval.
 */
export async function handleEscrowTransaction(
  repo: AvalesRepository,
  owner: string,
  offerSequence: number,
  txType: EscrowResolutionTx,
  txHash?: string,
): Promise<boolean> {
  const aval = await repo.findByEscrow(owner, offerSequence);
  if (!aval || aval.estado !== 'activo') return false;

  const now = new Date();
  if (txType === 'EscrowFinish') {
    await repo.update(aval.id, { estado: 'ejecutado', fechaEjecucion: now, txEjecucion: txHash ?? null });
  } else {
    await repo.update(aval.id, { estado: 'cumplido', fechaCumplimiento: now, txCumplimiento: txHash ?? null });
  }
  return true;
}
