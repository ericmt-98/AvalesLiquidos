import { Client, Wallet, multisign, type SubmittableTransaction } from 'xrpl';

/**
 * Submit a transaction signed by the Pool Master's multisignature set (report §3.1).
 * The master key is disabled, so EVERY outgoing Pool Master tx must go through here.
 *
 * `autofill(tx, signersCount)` is given the signer count so the fee scales with the
 * number of signatures. Each signer produces a multisign blob; `multisign` combines them.
 */
export async function submitMultisigned(
  client: Client,
  tx: SubmittableTransaction,
  signerWallets: Wallet[],
) {
  if (signerWallets.length === 0) {
    throw new Error('submitMultisigned requires at least one signer wallet');
  }
  const prepared = await client.autofill(tx, signerWallets.length);
  const blobs = signerWallets.map((w) => w.sign(prepared, true).tx_blob);
  return client.submitAndWait(multisign(blobs));
}
