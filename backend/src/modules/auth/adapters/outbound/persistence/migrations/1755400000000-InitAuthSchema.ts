import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The auth context's first migration.
 *
 * Creates its own schema and nothing outside it — the four contexts never
 * touch each other's tables, which is what makes the histories independent
 * (docs/decision.md D3, D4).
 *
 * `user_sessions` lives here rather than in the user schema: Auth is the only
 * context that writes it, and under per-context pools no other context can
 * reach it anyway (D15).
 */
export class InitAuthSchema1755400000000 implements MigrationInterface {
  name = 'InitAuthSchema1755400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "auth"`);

    await queryRunner.query(`
      CREATE TABLE "auth"."users" (
        "id"        uuid        NOT NULL,
        "email"     character varying NOT NULL,
        "password"  character varying NOT NULL,
        "role"      character varying NOT NULL DEFAULT 'user',
        "isActive"  boolean     NOT NULL DEFAULT true,
        "createdAt" timestamp with time zone NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "auth"."user_sessions" (
        "id"               uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId"           character varying NOT NULL,
        "refreshTokenHash" character varying NOT NULL,
        "userAgent"        character varying,
        "ip"               character varying,
        "createdAt"        TIMESTAMP NOT NULL,
        "expiresAt"        TIMESTAMP NOT NULL,
        "revokedAt"        TIMESTAMP,
        CONSTRAINT "PK_user_sessions_id" PRIMARY KEY ("id")
      )
    `);

    // The lookup on every refresh (spec-002 §6). A session is found by the
    // hash of the presented token, never by the token.
    await queryRunner.query(
      `CREATE INDEX "IDX_user_sessions_refreshTokenHash" ON "auth"."user_sessions" ("refreshTokenHash")`,
    );

    // Revoking every session for one user, the response to a detected reuse.
    await queryRunner.query(
      `CREATE INDEX "IDX_user_sessions_userId" ON "auth"."user_sessions" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "auth"."IDX_user_sessions_userId"`);
    await queryRunner.query(
      `DROP INDEX "auth"."IDX_user_sessions_refreshTokenHash"`,
    );
    await queryRunner.query(`DROP TABLE "auth"."user_sessions"`);
    await queryRunner.query(`DROP TABLE "auth"."users"`);
  }
}
