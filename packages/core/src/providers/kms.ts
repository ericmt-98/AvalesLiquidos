/**
 * KMS port: custody of the escrow fulfillment (the secret that releases funds).
 *
 * The engine only ever holds an opaque REFERENCE to the secret, never the secret
 * itself (report §2.3, §3.3). Decryption requires a quorum authorization token, so a
 * leaked reference alone cannot release an escrow.
 *
 * MVP uses {@link MockKmsProvider}; production implements this against AWS KMS
 * (backup HashiCorp Vault). Keep this interface stable so flows don't get rewritten.
 */
export interface KmsProvider {
  /** Encrypt `secret` under logical key `keyId`, returning an opaque reference. */
  encryptAndStore(keyId: string, secret: string): Promise<string>;
  /** Decrypt a stored secret. Requires a valid quorum authorization token. */
  decrypt(ref: string, authToken: string): Promise<string>;
}

/**
 * In-memory mock for testnet/PoC. "Encryption" is just an in-memory map — it does NOT
 * provide real confidentiality and must never be used with real funds.
 *
 * `isAuthorized` is injected so the mock can validate tokens issued by a paired
 * QuorumProvider, demonstrating the quorum-gated release without coupling the two.
 */
export class MockKmsProvider implements KmsProvider {
  private readonly store = new Map<string, string>();
  private counter = 0;

  constructor(private readonly isAuthorized: (token: string) => boolean = (t) => Boolean(t)) {}

  async encryptAndStore(keyId: string, secret: string): Promise<string> {
    const ref = `kms-mock:${keyId}:${++this.counter}`;
    this.store.set(ref, secret);
    return ref;
  }

  async decrypt(ref: string, authToken: string): Promise<string> {
    if (!this.isAuthorized(authToken)) {
      throw new Error('KMS decrypt denied: missing or invalid quorum authorization');
    }
    const secret = this.store.get(ref);
    if (secret === undefined) {
      throw new Error(`KMS reference not found: ${ref}`);
    }
    return secret;
  }
}
