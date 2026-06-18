import { Client } from 'xrpl';
import type { AvalesRepository } from '../db/repository';
import { handleEscrowTransaction } from './sync';

/** Shape of a `transaction` stream event, tolerating both api_version layouts. */
export interface TransactionStreamEvent {
  hash?: string;
  tx_json?: { TransactionType?: string; Owner?: string; OfferSequence?: number };
  transaction?: { TransactionType?: string; Owner?: string; OfferSequence?: number };
}

/**
 * Subscribe to `accounts`, THEN attach the transaction handler.
 *
 * Order matters (change #15): if you attach `client.on('transaction')` without a prior
 * `subscribe`, the server never streams and the listener never fires. Returns stop().
 */
export async function subscribeAndListen(
  client: Client,
  accounts: string[],
  onTransaction: (event: TransactionStreamEvent) => void | Promise<void>,
): Promise<() => Promise<void>> {
  await client.request({ command: 'subscribe', accounts });
  const handler = (event: unknown): void => {
    void onTransaction(event as TransactionStreamEvent);
  };
  client.on('transaction', handler);

  return async () => {
    client.off('transaction', handler);
    await client.request({ command: 'unsubscribe', accounts });
  };
}

/**
 * Start the reconciliation listener for the Pool Master account: on every
 * EscrowFinish/EscrowCancel, sync the matching aval by (Owner, OfferSequence) (§4).
 */
export async function startReconciliationListener(
  client: Client,
  repo: AvalesRepository,
  poolAddress: string,
): Promise<() => Promise<void>> {
  return subscribeAndListen(client, [poolAddress], async (event) => {
    const tx = event.tx_json ?? event.transaction;
    if (!tx) return;
    if (tx.TransactionType !== 'EscrowFinish' && tx.TransactionType !== 'EscrowCancel') return;
    if (typeof tx.Owner !== 'string' || typeof tx.OfferSequence !== 'number') return;
    await handleEscrowTransaction(repo, tx.Owner, tx.OfferSequence, tx.TransactionType, event.hash);
  });
}
