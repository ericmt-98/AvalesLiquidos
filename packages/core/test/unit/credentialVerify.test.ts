import { describe, it, expect } from 'vitest';
import { selectValidTier, lsfAccepted, credentialTypeHex, type CredentialLike } from '../../src';

const ISSUER = 'rIssuerPool';
const NOW = 800_000_000; // arbitrary Ripple Epoch "now"

function cred(over: Partial<CredentialLike> = {}): CredentialLike {
  return {
    LedgerEntryType: 'Credential',
    Issuer: ISSUER,
    Flags: lsfAccepted,
    CredentialType: credentialTypeHex('silver'),
    ...over,
  };
}

describe('selectValidTier — complete verification (report §3.4, change #7)', () => {
  it('returns the tier for a valid, accepted, unexpired credential', () => {
    expect(selectValidTier([cred()], ISSUER, NOW)).toBe('silver');
  });

  it('ignores a credential from a different issuer', () => {
    expect(selectValidTier([cred({ Issuer: 'rSomeoneElse' })], ISSUER, NOW)).toBeNull();
  });

  it('ignores a credential that has not been accepted', () => {
    expect(selectValidTier([cred({ Flags: 0 })], ISSUER, NOW)).toBeNull();
  });

  it('ignores an expired credential but honors a future expiry', () => {
    expect(selectValidTier([cred({ Expiration: NOW - 1 })], ISSUER, NOW)).toBeNull();
    expect(selectValidTier([cred({ Expiration: NOW + 1 })], ISSUER, NOW)).toBe('silver');
  });

  it('ignores non-credential ledger entries and unknown types', () => {
    expect(selectValidTier([cred({ LedgerEntryType: 'RippleState' })], ISSUER, NOW)).toBeNull();
    expect(selectValidTier([cred({ CredentialType: 'DEADBEEF' })], ISSUER, NOW)).toBeNull();
  });

  it('picks the valid credential among several invalid ones', () => {
    const objects = [
      cred({ Issuer: 'rOther' }),
      cred({ Flags: 0 }),
      cred({ CredentialType: credentialTypeHex('gold') }),
    ];
    expect(selectValidTier(objects, ISSUER, NOW)).toBe('gold');
  });
});
