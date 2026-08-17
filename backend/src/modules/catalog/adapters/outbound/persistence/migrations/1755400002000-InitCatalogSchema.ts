import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The catalog context's first migration.
 *
 * `parentId` is a self-reference within this schema and could carry a foreign
 * key, but does not: the entity declares no relation, so the next generated
 * migration would drop a hand-added one. It stays a plain indexed column until
 * the entity says otherwise.
 *
 * A cascade would be wrong here in any case. Archiving a subtree is a domain
 * operation that emits one event per catalog (spec-003 §1); a database cascade
 * would remove rows without anyone learning that the products beneath them
 * need archiving too.
 */
export class InitCatalogSchema1755400002000 implements MigrationInterface {
  name = 'InitCatalogSchema1755400002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "catalog"`);

    await queryRunner.query(`
      CREATE TABLE "catalog"."catalogs" (
        "id"        character varying NOT NULL,
        "name"      character varying NOT NULL,
        "parentId"  character varying,
        "status"    character varying NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL,
        "version"   integer NOT NULL,
        CONSTRAINT "PK_catalogs_id" PRIMARY KEY ("id")
      )
    `);

    // The tree endpoint and the subtree walk both filter on parentId.
    await queryRunner.query(
      `CREATE INDEX "IDX_catalogs_parentId" ON "catalog"."catalogs" ("parentId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "catalog"."IDX_catalogs_parentId"`);
    await queryRunner.query(`DROP TABLE "catalog"."catalogs"`);
  }
}
