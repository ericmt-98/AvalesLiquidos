/**
 * KYC port: identity verification, modeled as a pluggable interface so the real
 * provider (Mexican INE/CURP) can be integrated later WITHOUT rewriting flows
 * (arquitectura_producto.md §12, docs/decisions.md ADR-8).
 *
 * Business rule (enforced where credentials are issued, Fase D): reputation
 * credentials are only granted to a user once status is 'approved'.
 */
export type KycStatus = 'pending' | 'approved' | 'rejected';

export interface KycProvider {
  /** Begin verification for a user; returns a session handle and initial status. */
  startVerification(userId: string, payload?: unknown): Promise<{ sessionId: string; status: KycStatus }>;
  /** Current status of a verification session. */
  getStatus(sessionId: string): Promise<KycStatus>;
}

/**
 * Manual/stub provider for MVP and sandbox: sessions start `pending` and are resolved
 * by an operator via {@link approve}/{@link reject}. Lets the whole system run
 * end-to-end with no real KYC vendor.
 */
export class ManualKycProvider implements KycProvider {
  private readonly sessions = new Map<string, KycStatus>();
  private counter = 0;

  constructor(private readonly initialStatus: KycStatus = 'pending') {}

  async startVerification(userId: string): Promise<{ sessionId: string; status: KycStatus }> {
    const sessionId = `kyc-manual:${userId}:${++this.counter}`;
    this.sessions.set(sessionId, this.initialStatus);
    return { sessionId, status: this.initialStatus };
  }

  async getStatus(sessionId: string): Promise<KycStatus> {
    return this.sessions.get(sessionId) ?? 'rejected';
  }

  /** Sandbox/admin: mark a session approved. */
  approve(sessionId: string): void {
    this.sessions.set(sessionId, 'approved');
  }

  /** Sandbox/admin: mark a session rejected. */
  reject(sessionId: string): void {
    this.sessions.set(sessionId, 'rejected');
  }
}
