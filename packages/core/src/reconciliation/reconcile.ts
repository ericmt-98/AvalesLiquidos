import { Client } from 'xrpl';
import type { AvalesRepository } from '../db/repository';
import { handleEscrowTransaction, type EscrowResolutionTx } from './sync';

/**
 * Periodic safety net (§4): a websocket can drop. For every 'activo' aval, check the
 * escrow still exists on-chain; if it's gone, find how it ended in account history and
 * reconcile the DB. Run on a schedule (e.g. hourly). Returns the count reconciled.
 */
export async function reconcileState(client: Client, repo: AvalesRepository): Promise<number> {
  const activos = await repo.findByEstado('activo');
  let reconciled = 0;

  for (const aval of activos) {
    if (await escrowStillExists(client, aval.escrowOwner, aval.escrowSequence)) continue;

    const resolution = await resolveFromHistory(client, aval.escrowOwner, aval.escrowSequence);
    if (!resolution) continue;

    const changed = await handleEscrowTransaction(
      repo,
      aval.escrowOwner,
      aval.escrowSequence,
      resolution.txType,
      resolution.hash,
    );
    if (changed) reconciled++;
  }

  return reconciled;
}

async function escrowStillExists(client: Client, owner: string, seq: number): Promise<boolean> {
  try {
    await client.request({ command: 'ledger_entry', escrow: { owner, seq } });
    return true;
  } catch {
    return false;
  }
}

interface AccountTxEntry {
  hash?: string;
  tx?: { TransactionType?: string; Owner?: string; OfferSequence?: number; hash?: string };
  tx_json?: { TransactionType?: string; Owner?: string; OfferSequence?: number };
}

interface Resolution {
  txType: EscrowResolutionTx;
  hash?: string;
}

/** Find the EscrowFinish/EscrowCancel that closed a given escrow in account history. */
async function resolveFromHistory(
  client: Client,
  owner: string,
  seq: number,
): Promise<Resolution | null> {
  const { result } = await client.request({ command: 'account_tx', account: owner, limit: 100 });
  const entries = result.transactions as unknown as AccountTxEntry[];

  for (const entry of entries) {
    const tx = entry.tx_json ?? entry.tx;
    if (!tx) continue;
    const isResolution = tx.TransactionType === 'EscrowFinish' || tx.TransactionType === 'EscrowCancel';
    if (isResolution && tx.Owner === owner && tx.OfferSequence === seq) {
      return { txType: tx.TransactionType as EscrowResolutionTx, hash: entry.hash ?? entry.tx?.hash };
    }
  }
  return null;
}
