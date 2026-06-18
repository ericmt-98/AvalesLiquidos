/** State of an aval. Mirrors the CHECK constraint in schema.sql. */
export type Estado = 'activo' | 'cumplido' | 'ejecutado' | 'expirado';

/** A persisted aval (operational source of truth; the ledger is the audit trail, §2.1). */
export interface AvalRecord {
  id: string;
  escrowOwner: string;
  escrowSequence: number;
  userAddress: string;
  beneficiaryAddress: string;
  amountXRP: number;
  vencimiento: Date;
  /** Ripple Epoch seconds. */
  cancelAfter: number;
  condition: string;
  /** KMS reference to the fulfillment — never the secret itself. */
  fulfillmentRef: string;
  contractHash: string;
  estado: Estado;
  fechaEjecucion: Date | null;
  txEjecucion: string | null;
  quorumRecord: string | null;
  fechaCumplimiento: Date | null;
  txCumplimiento: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields required to create an aval (estado defaults to 'activo'). */
export interface CreateAvalInput {
  id: string;
  escrowOwner: string;
  escrowSequence: number;
  userAddress: string;
  beneficiaryAddress: string;
  amountXRP: number;
  vencimiento: Date;
  cancelAfter: number;
  condition: string;
  fulfillmentRef: string;
  contractHash: string;
}

/** Mutable fields, set when an aval resolves (executed or completed). */
export type UpdateAvalPatch = Partial<
  Pick<
    AvalRecord,
    'estado' | 'fechaEjecucion' | 'txEjecucion' | 'quorumRecord' | 'fechaCumplimiento' | 'txCumplimiento'
  >
>;
