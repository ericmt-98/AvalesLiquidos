import { describe, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import { PostgresAvalesRepository, applySchema, createPool, config } from '../../src';
import { avalesRepositoryContract } from '../contract/avalesRepository.contract';

const dbUrl = config.db.url;

/**
 * Integration: runs the repository contract against a real local Postgres.
 * Skipped automatically if DB_URL is not set (e.g. `docker compose up -d postgres`
 * not running). See docker-compose.yml.
 */
describe.skipIf(!dbUrl)('PostgresAvalesRepository (contract · local postgres)', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPool(dbUrl as string);
    await applySchema(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  avalesRepositoryContract(() => new PostgresAvalesRepository(pool));
});
