import { describe, it, expect } from 'vitest';
import { xrpToDrops } from 'xrpl';
import { withClient, subscribeAndListen, type TransactionStreamEvent } from '../../src';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Integration (testnet): proves change #15 — the transaction listener only fires when
 * `subscribe` precedes `client.on('transaction')`.
 */
describe('reconciliation listener (integration · testnet)', () => {
  it('does not fire without subscribe, fires after subscribe', async () => {
    await withClient(async (client) => {
      const a = (await client.fundWallet()).wallet;
      const b = (await client.fundWallet()).wallet;
      const events: TransactionStreamEvent[] = [];

      // Phase 1: attach a handler WITHOUT subscribing — it must not fire.
      const handler = (e: unknown): void => {
        events.push(e as TransactionStreamEvent);
      };
      client.on('transaction', handler);
      await client.submitAndWait(
        { TransactionType: 'Payment', Account: a.classicAddress, Destination: b.classicAddress, Amount: xrpToDrops(1) },
        { wallet: a },
      );
      await sleep(4_000);
      const withoutSubscribe = events.length;
      client.off('transaction', handler);

      // Phase 2: subscribe first, then listen — it must fire.
      const stop = await subscribeAndListen(client, [a.classicAddress], (e) => {
        events.push(e);
      });
      await client.submitAndWait(
        { TransactionType: 'Payment', Account: a.classicAddress, Destination: b.classicAddress, Amount: xrpToDrops(1) },
        { wallet: a },
      );
      await sleep(4_000);
      await stop();

      expect(withoutSubscribe).toBe(0);
      expect(events.length).toBeGreaterThan(0);
    });
  }, 120_000);
});
