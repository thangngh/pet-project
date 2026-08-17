import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The catalog context's transactional outbox (spec-003).
 *
 * Lives in the catalog schema, not a shared one: under per-context pools (D4) a
 * context that moves to its own database must take its outbox with it, and a
 * shared table would reintroduce exactly the coupling D4 removed.
 */
export class AddCatalogOutbox1755400011000 implements MigrationInterface {
  name = 'AddCatalogOutbox1755400011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "catalog"."outbox_messages" (
        "id"            uuid NOT NULL,
        "eventName"     character varying NOT NULL,
        "payload"       jsonb NOT NULL,
        "occurredOn"    timestamp with time zone NOT NULL,
        "dispatchedAt"  timestamp with time zone,
        "attempts"      integer NOT NULL DEFAULT 0,
        "lastError"     text,
        "lastAttemptAt" timestamp with time zone,
        "correlationId" text,
        CONSTRAINT "PK_catalog_outbox_messages_id" PRIMARY KEY ("id")
      )
    `);

    // The poller's only query: undispatched, oldest first.
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_messages_dispatchedAt_occurredOn" ON "catalog"."outbox_messages" ("dispatchedAt", "occurredOn")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "catalog"."IDX_outbox_messages_dispatchedAt_occurredOn"`,
    );
    await queryRunner.query(`DROP TABLE "catalog"."outbox_messages"`);
  }
}
