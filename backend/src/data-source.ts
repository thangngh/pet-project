import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import {
  DB_CONTEXTS,
  DbContext,
  contextDb,
} from './shared/adapters/config/context-db.config';

loadEnv();

/**
 * The migration CLI's data source, selected by DB_CONTEXT.
 *
 * One history per bounded context (docs/decision.md D3, D4). This reads the
 * same `contextDb` helper the application does, so the CLI and the running
 * system can never disagree about where a context's tables live — which is
 * the failure that leaves migrations applied to the wrong schema.
 *
 * Driven by scripts/migrate.mjs; not usually invoked directly.
 */
const context = process.env.DB_CONTEXT as DbContext;

if (!DB_CONTEXTS.includes(context)) {
  throw new Error(
    `DB_CONTEXT must be one of: ${DB_CONTEXTS.join(', ')} (got: ${
      process.env.DB_CONTEXT ?? 'unset'
    }). Use "pnpm migration:run", which sets it per context.`,
  );
}

const db = contextDb(context);

export default new DataSource({
  type: 'postgres',
  host: db.host,
  port: db.port,
  username: db.username,
  password: db.password,
  database: db.database,
  schema: db.schema,
  uuidExtension: 'pgcrypto',

  entities: [`src/modules/${context}/**/*.entity.ts`],
  migrations: [`src/modules/${context}/**/migrations/*.ts`],

  // Each context's `migrations` table lives in its own schema, so the four
  // histories are genuinely independent — `revert --context catalog` cannot
  // reach into another context's history.
  migrationsTableName: 'migrations',
});
