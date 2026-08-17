#!/usr/bin/env node
/**
 * Migration driver — one history per bounded context (docs/decision.md D3, D4).
 *
 *   pnpm migration:run                          every context, in order
 *   pnpm migration:run --context catalog        one context
 *   pnpm migration:revert --context catalog     one context, required
 *   pnpm migration:generate --context catalog --name AddSlug
 *   pnpm migration:show
 *
 * `run` and `show` iterate because applying every pending migration is safe.
 * `revert` and `generate` refuse to guess: both are destructive to get wrong,
 * and a context argument is cheaper than restoring a database.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CONTEXTS = ['auth', 'user', 'catalog', 'product'];

const MIGRATION_DIR = (context) =>
  `src/modules/${context}/adapters/outbound/persistence/migrations`;

const [command, ...rest] = process.argv.slice(2);

const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
};

const die = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

const requested = flag('context');

if (requested && !CONTEXTS.includes(requested)) {
  die(`Unknown context "${requested}". One of: ${CONTEXTS.join(', ')}`);
}

if (!['run', 'revert', 'generate', 'show'].includes(command)) {
  die('Usage: migrate.mjs <run|revert|generate|show> [--context <name>] [--name <MigrationName>]');
}

if ((command === 'revert' || command === 'generate') && !requested) {
  die(
    `"${command}" needs an explicit --context (${CONTEXTS.join(
      ' | ',
    )}).\n  Reverting or generating against the wrong context is not something to guess at.`,
  );
}

const targets = requested ? [requested] : CONTEXTS;

const node = (context, args, what) => {
  const result = spawnSync('node', ['--no-warnings', ...args], {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, DB_CONTEXT: context },
  });

  if (result.status !== 0) {
    die(`${what} failed for context "${context}" — nothing further attempted.`);
  }
};

const TS_NODE = ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'];

/**
 * TypeORM writes its `migrations` table into the context's schema before it
 * runs anything, so the schema must exist before the first migration — which
 * is the migration that declares it. See src/ensure-schema.ts.
 */
const ensureSchema = (context) =>
  node(context, [...TS_NODE, 'src/ensure-schema.ts'], 'schema creation');

const typeorm = (context, args) =>
  node(
    context,
    [...TS_NODE, 'node_modules/typeorm/cli.js', ...args, '-d', 'src/data-source.ts'],
    command,
  );

for (const context of targets) {
  console.log(`\n── ${command}: ${context} ${'─'.repeat(Math.max(0, 40 - context.length))}`);

  ensureSchema(context);

  if (command === 'generate') {
    const name = flag('name');
    if (!name) die('generate needs --name <MigrationName>');

    const dir = resolve(backendDir, MIGRATION_DIR(context));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    typeorm(context, ['migration:generate', `${MIGRATION_DIR(context)}/${name}`]);
    console.log(
      `\n  Read the generated SQL before committing it. A generated migration\n` +
        `  is a guess at intent, and this repository has been bitten by\n` +
        `  unreviewed assumptions before.\n`,
    );
  } else {
    typeorm(context, [`migration:${command}`]);
  }
}

console.log(`\n${command} complete: ${targets.join(', ')}\n`);
