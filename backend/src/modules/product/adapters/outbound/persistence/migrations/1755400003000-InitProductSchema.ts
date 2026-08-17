import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The product context's first migration.
 *
 * `catalogId` points into another context and therefore carries no foreign
 * key — Catalog may end up in a different database entirely (docs/decision.md
 * D4). Products learn that a catalog was archived through CatalogDeleted, not
 * through a constraint.
 *
 * `attributes` and `media` are TypeORM `simple-json`, which is `text` holding
 * a JSON string, not `jsonb`. Kept as-is to match the entity; changing it is a
 * data migration and belongs to whichever slice needs to query inside them.
 */
export class InitProductSchema1755400003000 implements MigrationInterface {
  name = 'InitProductSchema1755400003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "product"`);

    await queryRunner.query(`
      CREATE TABLE "product"."products" (
        "id"          character varying NOT NULL,
        "catalogId"   character varying NOT NULL,
        "name"        character varying NOT NULL,
        "description" character varying,
        "status"      character varying NOT NULL DEFAULT 'draft',
        "createdBy"   character varying NOT NULL,
        "attributes"  text,
        "media"       text,
        "createdAt"   TIMESTAMP NOT NULL,
        "updatedAt"   TIMESTAMP NOT NULL,
        "version"     integer NOT NULL,
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id")
      )
    `);

    // How CatalogDeleted finds what to archive, and how search filters.
    await queryRunner.query(
      `CREATE INDEX "IDX_products_catalogId" ON "product"."products" ("catalogId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_status" ON "product"."products" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "product"."IDX_products_status"`);
    await queryRunner.query(`DROP INDEX "product"."IDX_products_catalogId"`);
    await queryRunner.query(`DROP TABLE "product"."products"`);
  }
}
