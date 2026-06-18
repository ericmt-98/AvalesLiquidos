import { describe, it, expect } from 'vitest';
import { Wallet, xrpToDrops, type Client } from 'xrpl';
import { randomUUID, createHash } from 'node:crypto';
import {
  withClient,
  setupPoolMaster,
  createAval,
  executeDefault,
  markAsCompleted,
  getValidTier,
  issueCredential,
  acceptCredential,
  InMemoryAvalesRepository,
  MockKmsProvider,
  MockQuorumProvider,
  QUORUM,
  nowRippleTime,
} from '../../src';

async function balanceDrops(client: Client, address: string): Promise<number> {
  const { result } = await client.request({ command: 'account_info', account: address });
  return Number(result.account_data.Balance);
}

async function escrowExists(client: Client, owner: string, seq: number): Promise<boolean> {
  try {
    await client.request({ command: 'ledger_entry', escrow: { owner, seq } });
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Integration (testnet): the full aval core. One pool setup, both outcomes.
 *  E1 create → E2 EscrowFinish (default)   — proves "finish any time before CancelAfter" (#6)
 *  E1 create → E3 EscrowCancel (completion) — proves cancel gated on cancel_after (#4)
 */
describe('aval lifecycle (integration · testnet)', () => {
  it('creates an escrow, executes a default, and cancels another after CancelAfter', async () => {
    await withClient(async (client) => {
      // --- setup: pool master (multisig), issuer/executor, user, beneficiary ---
      const signers = Array.from({ length: QUORUM.signerCount }, () => Wallet.generate());
      const pool = await setupPoolMaster(client, signers.map((s) => s.classicAddress));
      const signerSubset = signers.slice(0, QUORUM.threshold);
      const issuer = (await client.fundWallet()).wallet; // also acts as executor
      const user = (await client.fundWallet()).wallet;
      const beneficiary = (await client.fundWallet()).wallet;

      await issueCredential({ client, issuerWallet: issuer, subjectAddress: user.classicAddress, tier: 'gold' });
      await acceptCredential({ client, subjectWallet: user, issuerAddress: issuer.classicAddress, tier: 'gold' });
      expect(await getValidTier(client, issuer.classicAddress, user.classicAddress)).toBe('gold');

      const repo = new InMemoryAvalesRepository();
      const quorum = new MockQuorumProvider(true);
      const kms = new MockKmsProvider((t) => quorum.grantedTokens.has(t));
      const contractHash = createHash('sha256').update('contrato-de-renta-1').digest('hex').toUpperCase();
      const amountXRP = 5;

      const common = {
        client,
        repo,
        kms,
        poolAddress: pool.classicAddress,
        signerWallets: signerSubset,
        issuerAddress: issuer.classicAddress,
        userAddress: user.classicAddress,
        beneficiaryAddress: beneficiary.classicAddress,
        amountXRP,
        contractHash,
      };

      // === E1: create (default path) ===
      const a1 = await createAval({ ...common, durationDays: 30, avalId: randomUUID() });

      const entry = await client.request({
        command: 'ledger_entry',
        escrow: { owner: pool.classicAddress, seq: a1.escrowSequence },
      });
      const node = entry.result.node as unknown as Record<string, unknown>;
      expect(node.FinishAfter).toBeUndefined(); // Condition + CancelAfter only (#6)
      expect(node.Condition).toBeDefined();
      expect(node.CancelAfter).toBeDefined();
      // The Memo lives on the EscrowCreate transaction, not the escrow ledger object.
      const tx = await client.request({ command: 'tx', transaction: a1.txHash });
      expect(JSON.stringify(tx.result)).toContain(contractHash); // contract hash in Memo
      // fulfillment must never be persisted in cleartext
      expect(JSON.stringify(await repo.findById(a1.avalId))).not.toContain('A0228020');

      // === E2: execute default (EscrowFinish) ===
      const before = await balanceDrops(client, beneficiary.classicAddress);
      await executeDefault({ client, repo, kms, quorum, executorWallet: issuer, avalId: a1.avalId });
      const after = await balanceDrops(client, beneficiary.classicAddress);
      expect(after - before).toBe(Number(xrpToDrops(amountXRP))); // beneficiary received the full amount
      expect((await repo.findById(a1.avalId))?.estado).toBe('ejecutado');
      expect(await escrowExists(client, pool.classicAddress, a1.escrowSequence)).toBe(false);

      // === E3: create (completion path) with a short CancelAfter ===
      const shortCancel = nowRippleTime() + 20;
      const a2 = await createAval({ ...common, durationDays: 0, avalId: randomUUID(), cancelAfter: shortCancel });

      // cancel BEFORE cancel_after must be rejected (#4)
      await expect(
        markAsCompleted({ client, repo, executorWallet: issuer, avalId: a2.avalId }),
      ).rejects.toThrow(/CancelAfter/);

      // wait until past cancel_after, then cancel → funds back to the pool
      await sleep(Math.max(0, shortCancel - nowRippleTime() + 5) * 1_000);
      await markAsCompleted({ client, repo, executorWallet: issuer, avalId: a2.avalId });
      expect((await repo.findById(a2.avalId))?.estado).toBe('cumplido');
      expect(await escrowExists(client, pool.classicAddress, a2.escrowSequence)).toBe(false);
    });
  }, 300_000);
});
