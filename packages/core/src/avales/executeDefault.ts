import { Client, Wallet } from 'xrpl';
import type { AvalesRepository } from '../db/repository';
import type { KmsProvider } from '../providers/kms';
import type { QuorumProvider } from '../providers/quorum';

export interface ExecuteDefaultParams {
  client: Client;
  repo: AvalesRepository;
  kms: KmsProvider;
  quorum: QuorumProvider;
  /** Any funded account may submit EscrowFinish (it pays the fulfillment fee surcharge). */
  executorWallet: Wallet;
  avalId: string;
  /** Optional side-effect after success, e.g. downgrade reputation. */
  onExecuted?: () => Promise<void>;
}

/**
 * Execute a default (report §3.5): require human quorum, decrypt the fulfillment ONLY
 * after quorum, then EscrowFinish. Valid at ANY time before CancelAfter — no window
 * (change #6). Marks the aval executed and archives the quorum record.
 */
export async function executeDefault(params: ExecuteDefaultParams): Promise<{ txHash: string }> {
  const { client, repo, kms, quorum, executorWallet, avalId } = params;

  const aval = await repo.findById(avalId);
  if (!aval || aval.estado !== 'activo') throw new Error('Aval is not active');

  // 1. Human quorum 3-of-5 with evidence — signed and archived (§2.3).
  const approval = await quorum.requireApproval(avalId, 'default_execution');
  if (!approval.granted) throw new Error('Quorum not reached');

  // 2. Decrypt the fulfillment only after quorum.
  const fulfillment = await kms.decrypt(aval.fulfillmentRef, approval.token);

  // 3. EscrowFinish with the fulfillment.
  const result = await client.submitAndWait(
    {
      TransactionType: 'EscrowFinish',
      Account: executorWallet.classicAddress,
      Owner: aval.escrowOwner,
      OfferSequence: aval.escrowSequence,
      Condition: aval.condition,
      Fulfillment: fulfillment,
    },
    { wallet: executorWallet },
  );
  const txHash = (result.result as { hash?: string }).hash ?? '';

  await repo.update(avalId, {
    estado: 'ejecutado',
    fechaEjecucion: new Date(),
    txEjecucion: txHash,
    quorumRecord: approval.recordId,
  });

  await params.onExecuted?.();
  return { txHash };
}
