import { Client, Wallet } from 'xrpl';
import { nowRippleTime } from '../xrpl/time';
import type { AvalesRepository } from '../db/repository';

export interface MarkAsCompletedParams {
  client: Client;
  repo: AvalesRepository;
  /** Any funded account may submit EscrowCancel after CancelAfter. */
  executorWallet: Wallet;
  avalId: string;
  /** Optional side-effect after success, e.g. upgrade reputation. */
  onCompleted?: () => Promise<void>;
}

/**
 * Close an aval by completion (report §3.6): EscrowCancel returns the funds to the pool.
 * Valid ONLY after CancelAfter — validated against cancel_after, NOT the vencimiento
 * (change #4). Marks the aval completed.
 */
export async function markAsCompleted(params: MarkAsCompletedParams): Promise<{ txHash: string }> {
  const { client, repo, executorWallet, avalId } = params;

  const aval = await repo.findById(avalId);
  if (!aval || aval.estado !== 'activo') throw new Error('Aval is not active');

  // EscrowCancel is valid only AFTER cancel_after (vencimiento + 30 days), not before.
  if (nowRippleTime() < aval.cancelAfter) {
    throw new Error('CancelAfter not reached yet (vencimiento + 30 days)');
  }

  const result = await client.submitAndWait(
    {
      TransactionType: 'EscrowCancel',
      Account: executorWallet.classicAddress,
      Owner: aval.escrowOwner,
      OfferSequence: aval.escrowSequence,
    },
    { wallet: executorWallet },
  );
  const txHash = (result.result as { hash?: string }).hash ?? '';

  await repo.update(avalId, {
    estado: 'cumplido',
    fechaCumplimiento: new Date(),
    txCumplimiento: txHash,
  });

  await params.onCompleted?.();
  return { txHash };
}
