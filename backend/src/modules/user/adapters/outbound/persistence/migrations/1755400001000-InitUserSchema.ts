import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The user context's first migration.
 *
 * `userId` is the primary key and carries no foreign key to auth.users: the
 * two contexts have separate pools and may end up in separate databases, so a
 * cross-context constraint is not available (docs/decision.md D4). Consistency
 * between the two comes from the UserCreated event, and will come from the
 * outbox once spec-003 lands.
 */
export class InitUserSchema1755400001000 implements MigrationInterface {
  name = 'InitUserSchema1755400001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "user"`);

    await queryRunner.query(`
      CREATE TABLE "user"."user_profiles" (
        "userId"    character varying NOT NULL,
        "firstName" character varying NOT NULL,
        "lastName"  character varying NOT NULL,
        "email"     character varying NOT NULL,
        "phone"     character varying,
        "avatar"    character varying,
        "status"    character varying NOT NULL DEFAULT 'inactive',
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL,
        "version"   integer NOT NULL,
        CONSTRAINT "PK_user_profiles_userId" PRIMARY KEY ("userId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user"."user_profiles"`);
  }
}
