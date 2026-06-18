import { Client, Wallet } from 'xrpl';
import type { Tier } from '../config';
import type { KycProvider } from '../providers/kyc';
import { credentialTypeHex } from './tiers';

/**
 * XLS-70 credential lifecycle (report §3.7). Three SEPARATE transactions — Batch is
 * not available, so no grouping (change #12):
 *   CredentialCreate (issuer) → CredentialAccept (subject) → CredentialDelete (either)
 *
 * Changing tier = delete old + create new + the subject must Accept the new one. Until
 * they accept, getValidTier returns null (user in transit cannot open avales, §3.7).
 */

export interface IssueCredentialParams {
  client: Client;
  issuerWallet: Wallet;
  subjectAddress: string;
  tier: Tier;
  /** Optional Ripple Epoch expiry. */
  expiration?: number;
}

export async function issueCredential(params: IssueCredentialParams) {
  const { client, issuerWallet, subjectAddress, tier, expiration } = params;
  return client.submitAndWait(
    {
      TransactionType: 'CredentialCreate',
      Account: issuerWallet.classicAddress,
      Subject: subjectAddress,
      CredentialType: credentialTypeHex(tier),
      ...(expiration !== undefined ? { Expiration: expiration } : {}),
    },
    { wallet: issuerWallet },
  );
}

export async function acceptCredential(params: {
  client: Client;
  subjectWallet: Wallet;
  issuerAddress: string;
  tier: Tier;
}) {
  const { client, subjectWallet, issuerAddress, tier } = params;
  return client.submitAndWait(
    {
      TransactionType: 'CredentialAccept',
      Account: subjectWallet.classicAddress,
      Issuer: issuerAddress,
      CredentialType: credentialTypeHex(tier),
    },
    { wallet: subjectWallet },
  );
}

export async function deleteCredential(params: {
  client: Client;
  signerWallet: Wallet; // issuer or subject may delete
  issuerAddress: string;
  subjectAddress: string;
  tier: Tier;
}) {
  const { client, signerWallet, issuerAddress, subjectAddress, tier } = params;
  return client.submitAndWait(
    {
      TransactionType: 'CredentialDelete',
      Account: signerWallet.classicAddress,
      Issuer: issuerAddress,
      Subject: subjectAddress,
      CredentialType: credentialTypeHex(tier),
    },
    { wallet: signerWallet },
  );
}

/**
 * Issue a reputation credential, GATED on KYC approval (arquitectura §12, ADR-8).
 * Throws before touching the ledger if KYC is not 'approved'.
 */
export async function issueReputationCredential(
  params: IssueCredentialParams & { kyc: KycProvider; kycSessionId: string },
) {
  const status = await params.kyc.getStatus(params.kycSessionId);
  if (status !== 'approved') {
    throw new Error(`Cannot issue reputation credential: KYC status is '${status}', expected 'approved'`);
  }
  return issueCredential(params);
}

/** Change a subject's tier: delete the old credential, create the new one (subject must Accept). */
export async function changeTier(params: {
  client: Client;
  issuerWallet: Wallet;
  subjectAddress: string;
  fromTier: Tier | null;
  toTier: Tier;
}) {
  const { client, issuerWallet, subjectAddress, fromTier, toTier } = params;
  if (fromTier) {
    await deleteCredential({
      client,
      signerWallet: issuerWallet,
      issuerAddress: issuerWallet.classicAddress,
      subjectAddress,
      tier: fromTier,
    });
  }
  await issueCredential({ client, issuerWallet, subjectAddress, tier: toTier });
}
