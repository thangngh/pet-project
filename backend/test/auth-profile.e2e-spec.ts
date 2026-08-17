import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * The chain spec-001 exists to make work:
 *
 *   register → the profile appears → login → GET /me → 200
 *
 * Every step of it failed for a different reason before this slice, and the
 * reasons were invisible to `tsc` and to the unit suite: an unbound provider,
 * a validation pipe that was never registered, no schema to write to, and an
 * identity that never reached RequestContext.
 *
 * Needs a real PostgreSQL with migrations applied:
 *
 *   docker compose up -d && pnpm migration:run && pnpm test:e2e
 */
describe('register → login → profile (e2e)', () => {
  let app: INestApplication;
  let userDb: DataSource;

  // Unique per run: registration is idempotent only in the sense that a
  // second attempt with the same email is rejected.
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'Str0ngPass';

  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // The same prefix main.ts applies. Kept in step with it by the route
    // assertion in src/app.bootstrap.spec.ts.
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();

    userDb = app.get<DataSource>(getDataSourceToken('user'));
  }, 30_000);

  afterAll(async () => {
    if (userId) {
      await userDb.query(
        'DELETE FROM "user"."user_profiles" WHERE "userId" = $1',
        [userId],
      );
      await app
        .get<DataSource>(getDataSourceToken('auth'))
        .query('DELETE FROM "auth"."users" WHERE id = $1', [userId]);
    }
    await app.close();
  });

  it('1. registers and returns tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it('2. the UserCreated handler creates a profile in the user context', async () => {
    // The handler runs on the event bus, not inside the request, so the row
    // may land a tick or two after the 201. Polling rather than sleeping keeps
    // the test fast when it passes and honest when it fails.
    const rows = await eventually(async () => {
      const found = await userDb.query(
        'SELECT "userId", email, status FROM "user"."user_profiles" WHERE email = $1',
        [email],
      );
      return found.length > 0 ? found : null;
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('active');
    userId = rows[0].userId;

    // Two connection pools, two schemas, one consistent picture. Until the
    // outbox lands (spec-003) this is in-process delivery: correct here, not
    // yet durable across a crash.
    const authRows = await app
      .get<DataSource>(getDataSourceToken('auth'))
      .query('SELECT id FROM "auth"."users" WHERE email = $1', [email]);
    expect(authRows[0].id).toBe(userId);
  });

  it('3. logs in', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    accessToken = res.body.accessToken;
    expect(accessToken).toEqual(expect.any(String));
  });

  it('4. GET /me returns the profile — identity reached RequestContext', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // This is the acceptance for the guard change. It cannot return the right
    // user unless the identity was written into the async context.
    expect(res.body.userId).toBe(userId);
    expect(res.body.email).toBe(email);
  });

  it('5. GET /me without a token is rejected', () =>
    request(app.getHttpServer()).get('/api/v1/me').expect(401));

  it('6. registration rejects a one-character password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `weak-${Date.now()}@example.com`, password: 'a' })
      .expect(400);

    expect(String(res.body.message)).toMatch(/password/i);
  });

  it('6b. registration cannot ask for a role', () =>
    // The field is gone and forbidNonWhitelisted rejects it, so re-adding it
    // by accident fails loudly rather than granting admin.
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `role-${Date.now()}@example.com`,
        password,
        role: 'admin',
      })
      .expect(400));

  it('7. product search defaults its paging instead of computing NaN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
  });

  it('7b. product search coerces the strings a query string delivers', () =>
    request(app.getHttpServer())
      .get('/api/v1/products/search?page=2&limit=5')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200));

  it('8. /health stays unprefixed, so probes survive a version bump', () =>
    request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('ok')));
});

/** Polls `probe` until it returns something non-null, or gives up. */
async function eventually<T>(
  probe: () => Promise<T | null>,
  { attempts = 40, intervalMs = 50 } = {},
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    const result = await probe();
    if (result !== null) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `Condition never became true within ${attempts * intervalMs}ms`,
  );
}
