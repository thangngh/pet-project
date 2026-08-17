import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import {
  OUTBOX,
  OUTBOX_POLLER,
} from './../src/shared/adapters/outbox/outbox.module';
import { Outbox } from './../src/shared/adapters/outbox/outbox';
import { OutboxPoller } from './../src/shared/adapters/outbox/outbox-poller';
import {
  AUTH_SERVICE,
  IAuthService,
} from './../src/modules/auth/application/ports/auth-service.port';
import { CatalogDeletedEvent } from './../src/shared/adapters/event-bus/integration-events/catalog-deleted.event';

/**
 * The transactional outbox (spec-003).
 *
 * The only property that matters is atomicity: if the aggregate write and the
 * enqueue are not in one transaction, this is a slower version of publishing
 * straight to the bus. Everything else here is plumbing around that.
 *
 * Polling is switched off (OUTBOX_POLLING=false) so the tests drain
 * deterministically with `tick()` rather than racing a timer.
 */
describe('outbox (e2e)', () => {
  let app: INestApplication;
  let authDb: DataSource;
  let catalogDb: DataSource;
  let productDb: DataSource;
  let catalogOutbox: Outbox;
  let catalogPoller: OutboxPoller;
  let authPoller: OutboxPoller;

  const stamp = Date.now();
  const adminEmail = `outbox-admin-${stamp}@example.com`;
  const password = 'Str0ngPass';
  let adminToken: string;

  beforeAll(async () => {
    process.env.OUTBOX_POLLING = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();

    authDb = app.get<DataSource>(getDataSourceToken('auth'));
    catalogDb = app.get<DataSource>(getDataSourceToken('catalog'));
    productDb = app.get<DataSource>(getDataSourceToken('product'));
    catalogOutbox = app.get<Outbox>(OUTBOX('catalog'), { strict: false });
    catalogPoller = app.get<OutboxPoller>(OUTBOX_POLLER('catalog'), {
      strict: false,
    });
    authPoller = app.get<OutboxPoller>(OUTBOX_POLLER('auth'), {
      strict: false,
    });

    await app
      .get<IAuthService>(AUTH_SERVICE, { strict: false })
      .ensureAdmin(adminEmail, password);

    adminToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password })
        .expect(200)
    ).body.accessToken;
  }, 30_000);

  afterAll(async () => {
    await authDb.query('DELETE FROM "auth"."users" WHERE email LIKE $1', [
      `outbox-%-${stamp}@example.com`,
    ]);
    await app.close();
    delete process.env.OUTBOX_POLLING;
  });

  const undispatched = async (db: DataSource, schema: string) =>
    (
      await db.query(
        `SELECT count(*)::int AS n FROM "${schema}"."outbox_messages" WHERE "dispatchedAt" IS NULL`,
      )
    )[0].n;

  describe('atomicity', () => {
    it('rolls the message back with the aggregate', async () => {
      const before = await undispatched(catalogDb, 'catalog');

      await expect(
        catalogOutbox.transaction(async (tx) => {
          await catalogOutbox.write(
            [new CatalogDeletedEvent('rollback-me')],
            tx,
          );
          throw new Error('the aggregate write failed');
        }),
      ).rejects.toThrow('the aggregate write failed');

      // This is the test that decides whether the outbox is worth having. A
      // message enqueued outside the aggregate's transaction survives a failed
      // write, and the consumer acts on something that never happened.
      expect(await undispatched(catalogDb, 'catalog')).toBe(before);

      const orphan = await catalogDb.query(
        `SELECT id FROM "catalog"."outbox_messages" WHERE payload->>'catalogId' = $1`,
        ['rollback-me'],
      );
      expect(orphan).toHaveLength(0);
    });

    it('enqueues in the same transaction as the aggregate write', async () => {
      const email = `outbox-atomic-${stamp}@example.com`;

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);

      const rows = await authDb.query(
        `SELECT m.* FROM "auth"."outbox_messages" m WHERE m.payload->>'email' = $1`,
        [email],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].eventName).toBe('UserCreatedEvent');

      // Undelivered, because polling is off. The account exists and the debt
      // is recorded — which is the state the old code could not represent.
      expect(rows[0].dispatchedAt).toBeNull();

      const profiles = await app
        .get<DataSource>(getDataSourceToken('user'))
        .query('SELECT * FROM "user"."user_profiles" WHERE email = $1', [
          email,
        ]);
      expect(profiles).toHaveLength(0);
    });
  });

  describe('delivery', () => {
    it('delivers what the transaction committed, after the fact', async () => {
      const email = `outbox-deliver-${stamp}@example.com`;

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);

      // Stands in for a restart: the process that wrote the message is not the
      // one that delivers it.
      const delivered = await authPoller.tick();
      expect(delivered).toBeGreaterThan(0);

      const profiles = await app
        .get<DataSource>(getDataSourceToken('user'))
        .query('SELECT * FROM "user"."user_profiles" WHERE email = $1', [
          email,
        ]);

      expect(profiles).toHaveLength(1);
      expect(profiles[0].status).toBe('active');
    });

    it('marks a delivered message so a second tick does not redeliver it', async () => {
      await authPoller.tick();
      expect(await authPoller.tick()).toBe(0);
    });

    it('is idempotent when the same message is delivered twice', async () => {
      const email = `outbox-twice-${stamp}@example.com`;

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);

      await authPoller.tick();

      // Force a redelivery, which is what at-least-once means in practice.
      await authDb.query(
        `UPDATE "auth"."outbox_messages" SET "dispatchedAt" = NULL WHERE payload->>'email' = $1`,
        [email],
      );
      await authPoller.tick();

      const profiles = await app
        .get<DataSource>(getDataSourceToken('user'))
        .query('SELECT * FROM "user"."user_profiles" WHERE email = $1', [
          email,
        ]);

      expect(profiles).toHaveLength(1);
    });
  });

  describe('subtree cascade', () => {
    it('archives every product beneath every descendant catalog', async () => {
      const create = async (name: string, parentId?: string) =>
        (
          await request(app.getHttpServer())
            .post('/api/v1/catalogs')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(parentId ? { name, parentId } : { name })
            .expect(201)
        ).body.id;

      const root = await create(`outbox-root-${stamp}`);
      const child = await create(`outbox-child-${stamp}`, root);
      const grandchild = await create(`outbox-grandchild-${stamp}`, child);

      const product = async (catalogId: string) =>
        (
          await request(app.getHttpServer())
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ catalogId, name: `p-${catalogId}` })
            .expect(201)
        ).body.id;

      const deep = await product(grandchild);
      const shallow = await product(root);

      await request(app.getHttpServer())
        .delete(`/api/v1/catalogs/${root}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // One message per archived catalog, so consumers never learn tree shape.
      const messages = await catalogDb.query(
        `SELECT payload->>'catalogId' AS id FROM "catalog"."outbox_messages" WHERE "dispatchedAt" IS NULL`,
      );
      expect(messages.map((m: { id: string }) => m.id).sort()).toEqual(
        [root, child, grandchild].sort(),
      );

      await catalogPoller.tick();

      const status = async (id: string) =>
        (
          await productDb.query(
            'SELECT status FROM "product"."products" WHERE id = $1',
            [id],
          )
        )[0].status;

      // Archiving used to stop at one level, leaving this one published.
      expect(await status(deep)).toBe('archived');
      expect(await status(shallow)).toBe('archived');
    });
  });

  describe('failure', () => {
    it('leaves a failing message undelivered, with the reason recorded', async () => {
      // An event with no handler: the dispatcher refuses rather than reporting
      // success for a message nothing acted on.
      await catalogDb.query(
        `INSERT INTO "catalog"."outbox_messages"
           (id, "eventName", payload, "occurredOn", attempts)
         VALUES (gen_random_uuid(), 'NoSuchEvent', '{}'::jsonb, now(), 0)`,
      );

      await catalogPoller.tick();

      const rows = await catalogDb.query(
        `SELECT * FROM "catalog"."outbox_messages" WHERE "eventName" = 'NoSuchEvent'`,
      );

      expect(rows[0].dispatchedAt).toBeNull();
      expect(rows[0].attempts).toBe(1);
      expect(rows[0].lastError).toMatch(/INTEGRATION_EVENTS/);

      await catalogDb.query(
        `DELETE FROM "catalog"."outbox_messages" WHERE "eventName" = 'NoSuchEvent'`,
      );
    });
  });
});
