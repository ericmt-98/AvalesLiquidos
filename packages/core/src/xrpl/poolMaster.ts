import { Client, Wallet, AccountSetAsfFlags } from 'xrpl';
import { QUORUM } from '../config';

/**
 * Set up the Pool Master account in the MANDATORY order (report §3.1):
 *   1. fund the account
 *   2. SignerListSet (define the N-of-M signer set)
 *   3. disable the master key (AccountSet asfDisableMaster) — last tx signed with it
 * After this, every Pool Master tx must be multisigned (see {@link submitMultisigned}).
 *
 * `fundWallet` is testnet-only; on mainnet the account is funded by a real transfer.
 *
 * Returns the Pool Master wallet. NOTE: its master key is now disabled and cannot sign;
 * keep only the address. In production the master seed should be destroyed securely.
 */
export async function setupPoolMaster(
  client: Client,
  signerAddresses: string[],
  signerQuorum: number = QUORUM.threshold,
): Promise<Wallet> {
  if (signerAddresses.length < signerQuorum) {
    throw new Error(
      `signerQuorum (${signerQuorum}) cannot exceed the number of signers (${signerAddresses.length})`,
    );
  }

  // 1. Fund the account (testnet faucet).
  const poolWallet = Wallet.generate();
  await client.fundWallet(poolWallet);

  // 2. Define the signer list (still signing with the master key here).
  await client.submitAndWait(
    {
      TransactionType: 'SignerListSet',
      Account: poolWallet.classicAddress,
      SignerQuorum: signerQuorum,
      SignerEntries: signerAddresses.map((address) => ({
        SignerEntry: { Account: address, SignerWeight: 1 },
      })),
    },
    { wallet: poolWallet },
  );

  // 3. Disable the master key — the final transaction signed with it.
  await client.submitAndWait(
    {
      TransactionType: 'AccountSet',
      Account: poolWallet.classicAddress,
      SetFlag: AccountSetAsfFlags.asfDisableMaster,
    },
    { wallet: poolWallet },
  );

  return poolWallet;
}
