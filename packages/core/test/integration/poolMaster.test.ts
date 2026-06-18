import { describe, it, expect } from 'vitest';
import { Wallet } from 'xrpl';
import { withClient, setupPoolMaster, submitMultisigned, QUORUM } from '../../src';

const lsfDisableMaster = 0x00100000;

type SubmitResult = { result: { meta?: unknown } };
function txResult(res: SubmitResult): string | undefined {
  const meta = res.result.meta;
  if (meta && typeof meta === 'object' && 'TransactionResult' in meta) {
    return (meta as { TransactionResult: string }).TransactionResult;
  }
  return undefined;
}

/**
 * Integration (testnet): funds a Pool Master, sets a 3-of-5 signer list, disables the
 * master key, runs a multisig tx, and proves the master key can no longer sign.
 * Guards plan change #5 (tefMASTER_DISABLED). Slow: funds + several ledger closes.
 */
describe('pool master multisig (integration · testnet)', () => {
  it('sets up 3-of-5, disables master, executes multisig, and blocks the master key', async () => {
    await withClient(async (client) => {
      const signers = Array.from({ length: QUORUM.signerCount }, () => Wallet.generate());
      const pool = await setupPoolMaster(
        client,
        signers.map((s) => s.classicAddress),
      );

      // Master key is disabled on-chain.
      const info = await client.request({
        command: 'account_info',
        account: pool.classicAddress,
      });
      expect(Number(info.result.account_data.Flags ?? 0) & lsfDisableMaster).toBeTruthy();

      // A 3-of-5 multisigned transaction succeeds.
      const ok = await submitMultisigned(
        client,
        {
          TransactionType: 'AccountSet',
          Account: pool.classicAddress,
          Domain: '6578616d706c652e636f6d', // "example.com"
        },
        signers.slice(0, QUORUM.threshold),
      );
      expect(txResult(ok)).toBe('tesSUCCESS');

      // Signing with the now-disabled master key must NOT succeed.
      let masterSignFailed = false;
      try {
        const res = await client.submitAndWait(
          { TransactionType: 'AccountSet', Account: pool.classicAddress, Domain: '6465616462656566' },
          { wallet: pool },
        );
        masterSignFailed = txResult(res) !== 'tesSUCCESS';
      } catch {
        masterSignFailed = true;
      }
      expect(masterSignFailed).toBe(true);
    });
  }, 180_000);
});
