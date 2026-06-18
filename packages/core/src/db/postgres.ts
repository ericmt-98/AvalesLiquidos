import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import type { AvalesRepository } from './repository';
import type { AvalRecord, CreateAvalInput, Estado, UpdateAvalPatch } from './types';

const schemaUrl = new URL('./schema.sql', import.meta.url);

/** Raw schema DDL (read from schema.sql). */
export function schemaSQL(): string {
  return readFileSync(schemaUrl, 'utf8');
}

/** Create a connection pool from a Postgres connection string. */
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

/** Apply the schema (idempotent — all statements use IF NOT EXISTS). */
export async function applySchema(pool: Pool): Promise<void> {
  await pool.query(schemaSQL());
}

interface AvalRow {
  id: string;
  escrow_owner: string;
  escrow_sequence: string;
  user_address: string;
  beneficiary_address: string;
  amount_xrp: string;
  vencimiento: Date;
  cancel_after: string;
  condition: string;
  fulfillment_ref: string;
  contract_hash: string;
  estado: Estado;
  fecha_ejecucion: Date | null;
  tx_ejecucion: string | null;
  quorum_record: string | null;
  fecha_cumplimiento: Date | null;
  tx_cumplimiento: string | null;
  created_at: Date;
  updated_at: Date;
}

function toRecord(r: AvalRow): AvalRecord {
  return {
    id: r.id,
    escrowOwner: r.escrow_owner,
    escrowSequence: Number(r.escrow_sequence),
    userAddress: r.user_address,
    beneficiaryAddress: r.beneficiary_address,
    amountXRP: Number(r.amount_xrp),
    vencimiento: r.vencimiento,
    cancelAfter: Number(r.cancel_after),
    condition: r.condition,
    fulfillmentRef: r.fulfillment_ref,
    contractHash: r.contract_hash,
    estado: r.estado,
    fechaEjecucion: r.fecha_ejecucion,
    txEjecucion: r.tx_ejecucion,
    quorumRecord: r.quorum_record,
    fechaCumplimiento: r.fecha_cumplimiento,
    txCumplimiento: r.tx_cumplimiento,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Maps UpdateAvalPatch keys → column names. */
const UPDATE_COLUMNS: Record<keyof UpdateAvalPatch, string> = {
  estado: 'estado',
  fechaEjecucion: 'fecha_ejecucion',
  txEjecucion: 'tx_ejecucion',
  quorumRecord: 'quorum_record',
  fechaCumplimiento: 'fecha_cumplimiento',
  txCumplimiento: 'tx_cumplimiento',
};

export class PostgresAvalesRepository implements AvalesRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateAvalInput): Promise<AvalRecord> {
    const { rows } = await this.pool.query<AvalRow>(
      `INSERT INTO avales
         (id, escrow_owner, escrow_sequence, user_address, beneficiary_address,
          amount_xrp, vencimiento, cancel_after, condition, fulfillment_ref, contract_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        input.id,
        input.escrowOwner,
        input.escrowSequence,
        input.userAddress,
        input.beneficiaryAddress,
        input.amountXRP,
        input.vencimiento,
        input.cancelAfter,
        input.condition,
        input.fulfillmentRef,
        input.contractHash,
      ],
    );
    return toRecord(rows[0]);
  }

  async findById(id: string): Promise<AvalRecord | null> {
    const { rows } = await this.pool.query<AvalRow>('SELECT * FROM avales WHERE id = $1', [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findByEscrow(owner: string, sequence: number): Promise<AvalRecord | null> {
    const { rows } = await this.pool.query<AvalRow>(
      'SELECT * FROM avales WHERE escrow_owner = $1 AND escrow_sequence = $2',
      [owner, sequence],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findByEstado(estado: Estado): Promise<AvalRecord[]> {
    const { rows } = await this.pool.query<AvalRow>(
      'SELECT * FROM avales WHERE estado = $1 ORDER BY created_at',
      [estado],
    );
    return rows.map(toRecord);
  }

  async findByBeneficiary(address: string): Promise<AvalRecord[]> {
    const { rows } = await this.pool.query<AvalRow>(
      'SELECT * FROM avales WHERE beneficiary_address = $1 ORDER BY created_at',
      [address],
    );
    return rows.map(toRecord);
  }

  async update(id: string, patch: UpdateAvalPatch): Promise<AvalRecord> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(patch) as [keyof UpdateAvalPatch, unknown][]) {
      const column = UPDATE_COLUMNS[key];
      if (!column) continue;
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    }
    setClauses.push('updated_at = now()');
    values.push(id);

    const { rows } = await this.pool.query<AvalRow>(
      `UPDATE avales SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!rows[0]) throw new Error(`Aval not found: ${id}`);
    return toRecord(rows[0]);
  }

  async nextDestinationTag(): Promise<number> {
    const { rows } = await this.pool.query<{ tag: string }>(
      "SELECT nextval('destination_tag_seq') AS tag",
    );
    return Number(rows[0].tag);
  }
}
