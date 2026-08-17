import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  AUTH_SERVICE,
  IAuthService,
} from './modules/auth/application/ports/auth-service.port';

/**
 * Creates the first admin — the bootstrap nothing else can solve.
 *
 * Registration cannot grant a role (that hole is closed), and the promote
 * endpoint is admin-only, so without this there is no path to an admin at all
 * and switching FEATURE_RBAC on would lock every admin endpoint against
 * everybody.
 *
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=... pnpm seed:admin
 *
 * Idempotent: it runs on every deploy and in CI, so a second run reports
 * "exists" and exits 0 rather than failing or creating a second admin.
 */
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must both be set.\n' +
        '  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=<strong> pnpm seed:admin',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const authService = app.get<IAuthService>(AUTH_SERVICE, { strict: false });

    // A weak password fails inside ensureAdmin, before anything is written:
    // the value object validates the plaintext before it is hashed. An admin
    // with a guessable password is worse than no admin.
    const result = await authService.ensureAdmin(email, password);

    console.log(
      result === 'created'
        ? `Admin created: ${email}`
        : `Admin already present: ${email} — nothing to do`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    `\nseed:admin failed — ${error instanceof Error ? error.message : error}\n`,
  );
  process.exit(1);
});
