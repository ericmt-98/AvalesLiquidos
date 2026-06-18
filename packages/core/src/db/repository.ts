import type { AvalRecord, CreateAvalInput, Estado, UpdateAvalPatch } from './types';

/**
 * Persistence port for avales. The engine depends on this interface, not on Postgres
 * (port pattern, consistent with KMS/Quorum/KYC). Adapters: {@link InMemoryAvalesRepository}
 * for fast unit tests, PostgresAvalesRepository for real local/prod use.
 */
export interface AvalesRepository {
  create(input: CreateAvalInput): Promise<AvalRecord>;
  findById(id: string): Promise<AvalRecord | null>;
  /** Look up by (escrow owner, sequence) — used by reconciliation (§4). */
  findByEscrow(owner: string, sequence: number): Promise<AvalRecord | null>;
  findByEstado(estado: Estado): Promise<AvalRecord[]>;
  findByBeneficiary(address: string): Promise<AvalRecord[]>;
  update(id: string, patch: UpdateAvalPatch): Promise<AvalRecord>;
  /** Next DestinationTag: sequential, unique, within uint32 (§3.3). */
  nextDestinationTag(): Promise<number>;
}
