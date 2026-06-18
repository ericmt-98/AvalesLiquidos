import type { AvalesRepository } from './repository';
import type { AvalRecord, CreateAvalInput, Estado, UpdateAvalPatch } from './types';

/**
 * In-memory adapter for fast, network-free unit tests. Mirrors the Postgres
 * constraints (unique id, unique escrow owner+sequence) so behaviour matches.
 */
export class InMemoryAvalesRepository implements AvalesRepository {
  private readonly rows = new Map<string, AvalRecord>();
  private tagCounter = 0;

  async create(input: CreateAvalInput): Promise<AvalRecord> {
    if (this.rows.has(input.id)) {
      throw new Error(`Duplicate aval id: ${input.id}`);
    }
    for (const r of this.rows.values()) {
      if (r.escrowOwner === input.escrowOwner && r.escrowSequence === input.escrowSequence) {
        throw new Error('Duplicate escrow (owner, sequence)');
      }
    }
    const now = new Date();
    const record: AvalRecord = {
      ...input,
      estado: 'activo',
      fechaEjecucion: null,
      txEjecucion: null,
      quorumRecord: null,
      fechaCumplimiento: null,
      txCumplimiento: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(record.id, record);
    return { ...record };
  }

  async findById(id: string): Promise<AvalRecord | null> {
    const r = this.rows.get(id);
    return r ? { ...r } : null;
  }

  async findByEscrow(owner: string, sequence: number): Promise<AvalRecord | null> {
    for (const r of this.rows.values()) {
      if (r.escrowOwner === owner && r.escrowSequence === sequence) return { ...r };
    }
    return null;
  }

  async findByEstado(estado: Estado): Promise<AvalRecord[]> {
    return [...this.rows.values()].filter((r) => r.estado === estado).map((r) => ({ ...r }));
  }

  async findByBeneficiary(address: string): Promise<AvalRecord[]> {
    return [...this.rows.values()].filter((r) => r.beneficiaryAddress === address).map((r) => ({ ...r }));
  }

  async update(id: string, patch: UpdateAvalPatch): Promise<AvalRecord> {
    const current = this.rows.get(id);
    if (!current) throw new Error(`Aval not found: ${id}`);
    const updated: AvalRecord = { ...current, ...patch, updatedAt: new Date() };
    this.rows.set(id, updated);
    return { ...updated };
  }

  async nextDestinationTag(): Promise<number> {
    return ++this.tagCounter;
  }
}
