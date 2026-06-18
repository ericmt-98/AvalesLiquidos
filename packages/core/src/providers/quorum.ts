/**
 * Quorum port: the human N-of-M approval that gates releasing the fulfillment
 * (report §2.3). This is the operator's custodial control, NOT the project's
 * (docs/decisions.md ADR-2/ADR-3). Each approval is signed and archived as evidence.
 *
 * MVP uses {@link MockQuorumProvider}; production wires a real signed workflow.
 */
export type QuorumAction = 'default_execution' | (string & {});

export interface QuorumApproval {
  /** Whether the quorum (e.g. 3-of-5) was reached. */
  granted: boolean;
  /** Authorization token to release the secret from KMS. Empty when not granted. */
  token: string;
  /** Id of the signed, archived approval record (audit trail). Empty when not granted. */
  recordId: string;
}

export interface QuorumProvider {
  /** Request approval for `action` on a given key, optionally attaching evidence. */
  requireApproval(
    keyId: string,
    action: QuorumAction,
    opts?: { evidence?: unknown },
  ): Promise<QuorumApproval>;
}

/**
 * Deterministic mock for tests/PoC. `autoGrant` decides the outcome; granted tokens
 * are tracked so a paired {@link MockKmsProvider} can validate them.
 */
export class MockQuorumProvider implements QuorumProvider {
  readonly grantedTokens = new Set<string>();
  private counter = 0;

  constructor(private readonly autoGrant: boolean = true) {}

  async requireApproval(keyId: string, action: QuorumAction): Promise<QuorumApproval> {
    const n = ++this.counter;
    if (!this.autoGrant) {
      return { granted: false, token: '', recordId: '' };
    }
    const token = `quorum-token:${keyId}:${action}:${n}`;
    const recordId = `quorum-record:${keyId}:${n}`;
    this.grantedTokens.add(token);
    return { granted: true, token, recordId };
  }
}
