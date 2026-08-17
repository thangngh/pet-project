/**
 * One connection pool per bounded context (docs/decision.md D4).
 *
 * Every context resolves its own connection settings through a two-step
 * fallback: a context-specific variable first, then the shared one. With no
 * per-context variables set, all four contexts land on the same server and
 * database — each still with its own pool and its own PostgreSQL schema.
 *
 * Setting DB_CATALOG_HOST and DB_CATALOG_DATABASE moves Catalog to a database
 * of its own. That fallback is the entire migration path: no code changes.
 *
 * This helper is the single source for both the application (app.config.ts)
 * and the migration CLI (src/data-source.ts), so the two cannot disagree about
 * where a context's tables live.
 */

export const DB_CONTEXTS = ['auth', 'user', 'catalog', 'product'] as const;

export type DbContext = (typeof DB_CONTEXTS)[number];

export interface ContextDbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
  poolSize: number;
  applicationName: string;
}

const pick = (contextKey: string, suffix: string): string | undefined =>
  process.env[`DB_${contextKey}_${suffix}`] ?? process.env[`DB_${suffix}`];

export function contextDb(context: DbContext): ContextDbConfig {
  const key = context.toUpperCase();

  return {
    host: pick(key, 'HOST') ?? 'localhost',
    port: parseInt(pick(key, 'PORT') ?? '5432', 10),
    username: pick(key, 'USERNAME') ?? 'postgres',
    password: pick(key, 'PASSWORD') ?? 'postgres',
    database: pick(key, 'DATABASE') ?? 'ddd_project',

    // The schema is the context's own, whether or not it shares a server.
    // A context looks the same to its own code either way.
    schema: context,

    poolSize: parseInt(process.env[`DB_${key}_POOL_SIZE`] ?? '10', 10),

    // Makes the four pools distinguishable in pg_stat_activity, so "four pools"
    // is a checkable claim rather than an assumed one.
    applicationName: `pet-${context}`,
  };
}

export const allContextDbConfigs = (): Record<DbContext, ContextDbConfig> =>
  DB_CONTEXTS.reduce(
    (acc, context) => ({ ...acc, [context]: contextDb(context) }),
    {} as Record<DbContext, ContextDbConfig>,
  );
