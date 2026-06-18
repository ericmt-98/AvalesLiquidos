-- Avales Líquidos — core schema (plan C1; fields from report §3.3).
-- estado lifecycle: activo → {ejecutado | cumplido}; expirado for housekeeping.

CREATE TABLE IF NOT EXISTS avales (
  id                  TEXT          PRIMARY KEY,
  escrow_owner        TEXT          NOT NULL,
  escrow_sequence     BIGINT        NOT NULL,
  user_address        TEXT          NOT NULL,
  beneficiary_address TEXT          NOT NULL,
  amount_xrp          NUMERIC(20,6) NOT NULL CHECK (amount_xrp > 0),
  vencimiento         TIMESTAMPTZ   NOT NULL,
  cancel_after        BIGINT        NOT NULL,                 -- Ripple Epoch seconds (§2.2)
  condition           TEXT          NOT NULL,
  fulfillment_ref     TEXT          NOT NULL,                 -- KMS reference, NEVER the secret (§2.3)
  contract_hash       TEXT          NOT NULL,
  estado              TEXT          NOT NULL DEFAULT 'activo'
                        CHECK (estado IN ('activo','cumplido','ejecutado','expirado')),
  -- outcome fields (filled by executeDefault / markAsCompleted)
  fecha_ejecucion     TIMESTAMPTZ,
  tx_ejecucion        TEXT,
  quorum_record       TEXT,
  fecha_cumplimiento  TIMESTAMPTZ,
  tx_cumplimiento     TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_escrow UNIQUE (escrow_owner, escrow_sequence)
);

CREATE INDEX IF NOT EXISTS idx_avales_estado      ON avales (estado);
CREATE INDEX IF NOT EXISTS idx_avales_beneficiary ON avales (beneficiary_address);
CREATE INDEX IF NOT EXISTS idx_avales_user        ON avales (user_address);

-- Signed/archived quorum approvals (audit trail, §2.3).
CREATE TABLE IF NOT EXISTS quorum_records (
  id           TEXT        PRIMARY KEY,
  aval_id      TEXT        NOT NULL REFERENCES avales(id),
  action       TEXT        NOT NULL,
  granted      BOOLEAN     NOT NULL,
  evidence_ref TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DestinationTag: sequential, unique, bounded to uint32 (§3.3).
CREATE SEQUENCE IF NOT EXISTS destination_tag_seq
  AS BIGINT START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 4294967295 NO CYCLE;
