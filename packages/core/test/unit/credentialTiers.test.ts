import { describe, it, expect } from 'vitest';
import {
  credentialTypeString,
  credentialTypeHex,
  parseCredentialTypeHex,
  tierUp,
  tierDown,
  TIERS,
} from '../../src';

describe('credential tiers (report §2.4, change #3)', () => {
  it('encodes REPUTACION_SILVER to the exact reference hex', () => {
    expect(credentialTypeHex('silver')).toBe('52455055544143494F4E5F53494C564552');
  });

  it('round-trips every tier through hex', () => {
    for (const tier of TIERS) {
      expect(credentialTypeString(tier)).toBe(`REPUTACION_${tier.toUpperCase()}`);
      expect(parseCredentialTypeHex(credentialTypeHex(tier))).toBe(tier);
    }
  });

  it('stays within the 64-byte CredentialType limit', () => {
    for (const tier of TIERS) {
      expect(credentialTypeHex(tier).length / 2).toBeLessThanOrEqual(64);
    }
  });

  it('rejects unknown or malformed hex', () => {
    expect(parseCredentialTypeHex('DEADBEEF')).toBeNull(); // valid hex, not a tier
    expect(parseCredentialTypeHex('ZZ')).toBeNull(); // not hex
    expect(parseCredentialTypeHex('A0F')).toBeNull(); // odd length
  });

  it('moves tiers up and down with caps', () => {
    expect(tierUp('bronze')).toBe('silver');
    expect(tierUp('platinum')).toBe('platinum');
    expect(tierDown('platinum')).toBe('gold');
    expect(tierDown('bronze')).toBe('bronze');
  });
});
