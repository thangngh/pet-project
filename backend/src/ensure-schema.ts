import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import {
  DB_CONTEXTS,
  DbContext,
  contextDb,
} from './shared/adapters/config/context-db.config';

loadEnv();

/**
 * Creates a context's PostgreSQL schema if it is absent.
 *
 * This cannot live in the context's first migration, though that migration
 * also declares it. TypeORM writes its `migrations` bookkeeping table *into*
 * the configured schema before it runs anything, so the schema has to exist
 * before the first migration can create it. Chicken and egg.
 *
 * So schema creation is a precondition, run by scripts/migrate.mjs just before
 * the TypeORM CLI. The `CREATE SCHEMA IF NOT EXISTS` inside each first
 * migration stays: it is idempotent, and it keeps the migration readable as a
 * complete description of what the context owns.
 */
async function main(): Promise<void> {
  const context = process.env.DB_CONTEXT as DbContext;

  if (!DB_CONTEXTS.includes(context)) {
    throw new Error(`DB_CONTEXT must be one of: ${DB_CONTEXTS.join(', ')}`);
  }

  const db = contextDb(context);
  const client = new Client({
    host: db.host,
    port: db.port,
    user: db.username,
    password: db.password,
    database: db.database,
    application_name: `${db.applicationName}-migrate`,
  });

  await client.connect();
  try {
    // The identifier comes from DB_CONTEXTS, not from user input, but quote it
    // anyway: "user" is a reserved word and would otherwise need special care.
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${context}"`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
