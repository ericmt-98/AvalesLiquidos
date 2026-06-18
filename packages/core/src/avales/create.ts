import { Client, Wallet, xrpToDrops, convertStringToHex } from 'xrpl';
import { CANCEL_MARGIN_DAYS } from '../config';
import { rippleTimeInDays } from '../xrpl/time';
import { generateCryptoCondition } from '../xrpl/cryptocondition';
import { submitMultisigned } from '../xrpl/multisig';
import { getValidTier } from '../credentials/verify';
import { enforceTierLimits } from './limits';
import type { KmsProvider } from '../providers/kms';
import type { AvalesRepository } from '../db/repository';

export interface CreateAvalParams {
  client: Client;
  repo: AvalesRepository;
  kms: KmsProvider;
  /** Pool Master account (escrow owner; multisig, master disabled). */
  poolAddress: string;
  /** Pool Master signer wallets (>= quorum). */
  signerWallets: Wallet[];
  userAddress: string;
  beneficiaryAddress: string;
  amountXRP: number;
  durationDays: number;
  /** Hex SHA-256 of the contract, stored in the escrow Memo. */
  contractHash: string;
  avalId: string;
  /** Credential issuer for the tier check; defaults to poolAddress. */
  issuerAddress?: string;
  /** Override CancelAfter (Ripple Epoch). Default: vencimiento + 30-day margin. */
  cancelAfter?: number;
}

export interface CreateAvalResult {
  avalId: string;
  escrowSequence: number;
  txHash: string;
}

/** Read a field from a submit result, tolerating both api_version shapes. */
function txField<T>(res: unknown, field: string): T | undefined {
  const r = (res as { result?: Record<string, unknown> & { tx_json?: Record<string, unknown> } }).result;
  return (r?.tx_json?.[field] ?? r?.[field]) as T | undefined;
}

/**
 * Create an aval (report §3.3): verify tier + limits, generate a crypto-condition,
 * encrypt the fulfillment to KMS, build a multisigned EscrowCreate with
 * Condition + CancelAfter (NO FinishAfter — §2.2, change #6), and persist.
 */
export async function createAval(params: CreateAvalParams): Promise<CreateAvalResult> {
  const {
    client, repo, kms, poolAddress, signerWallets, userAddress,
    beneficiaryAddress, amountXRP, durationDays, contractHash, avalId,
  } = params;
  const issuerAddress = params.issuerAddress ?? poolAddress;

  // 1. Complete credential check (§3.4) + tier limit.
  const tier = await getValidTier(client, issuerAddress, userAddress);
  if (!tier) throw new Error('User has no valid credential (accepted and unexpired)');
  enforceTierLimits(tier, amountXRP);

  // 2. Crypto-condition; the fulfillment goes encrypted to KMS — never to logs or DB.
  const { condition, fulfillment } = generateCryptoCondition();
  const fulfillmentRef = await kms.encryptAndStore(avalId, fulfillment);

  // 3. CancelAfter = vencimiento + 30-day margin, unless explicitly overridden.
  const now = Date.now();
  const cancelAfter =
    params.cancelAfter ?? rippleTimeInDays(durationDays + CANCEL_MARGIN_DAYS, new Date(now));
  const vencimiento = new Date(now + durationDays * 86_400 * 1_000);

  // 4. EscrowCreate (multisigned): Condition + CancelAfter, SIN FinishAfter.
  const destinationTag = await repo.nextDestinationTag();
  const result = await submitMultisigned(
    client,
    {
      TransactionType: 'EscrowCreate',
      Account: poolAddress,
      Destination: beneficiaryAddress,
      Amount: xrpToDrops(amountXRP),
      CancelAfter: cancelAfter,
      Condition: condition,
      DestinationTag: destinationTag,
      Memos: [{ Memo: { MemoType: convertStringToHex('aval_contract'), MemoData: contractHash } }],
    },
    signerWallets,
  );

  const escrowSequence = txField<number>(result, 'Sequence');
  if (typeof escrowSequence !== 'number') {
    throw new Error('Could not determine escrow Sequence from EscrowCreate result');
  }
  const txHash = txField<string>(result, 'hash') ?? '';

  // 5. Persist (the fulfillment ref, NOT the secret).
  await repo.create({
    id: avalId,
    escrowOwner: poolAddress,
    escrowSequence,
    userAddress,
    beneficiaryAddress,
    amountXRP,
    vencimiento,
    cancelAfter,
    condition,
    fulfillmentRef,
    contractHash,
  });

  return { avalId, escrowSequence, txHash };
}
