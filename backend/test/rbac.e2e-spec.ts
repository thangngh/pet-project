import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import {
  AUTH_SERVICE,
  IAuthService,
} from './../src/modules/auth/application/ports/auth-service.port';

/**
 * Eleven endpoints carry @Roles(ROLE_ADMIN). Until FEATURE_RBAC was switched
 * on, every one of them accepted any authenticated caller — the decorators
 * were decoration.
 *
 * All eleven are enumerated below rather than sampled. A missing @Roles is
 * exactly the kind of gap a sample misses, and the cost of listing them is
 * one line each.
 *
 * Needs a real PostgreSQL with migrations applied, and FEATURE_RBAC=true.
 */
describe('RBAC (e2e)', () => {
  let app: INestApplication;
  let authDb: DataSource;

  const stamp = Date.now();
  const adminEmail = `rbac-admin-${stamp}@example.com`;
  const userEmail = `rbac-user-${stamp}@example.com`;
  const password = 'Str0ngPass';

  let adminToken: string;
  let userToken: string;
  let plainUserId: string;

  const ADMIN_ONLY: Array<[string, string, object?]> = [
    ['post', '/api/v1/catalogs', { name: 'X' }],
    ['patch', '/api/v1/catalogs/does-not-exist', { name: 'Y' }],
    ['delete', '/api/v1/catalogs/does-not-exist'],
    ['post', '/api/v1/products', { catalogId: 'c', name: 'P' }],
    ['patch', '/api/v1/products/does-not-exist', { name: 'Q' }],
    ['post', '/api/v1/products/does-not-exist/publish'],
    ['post', '/api/v1/products/does-not-exist/archive'],
    [
      'post',
      '/api/v1/products/does-not-exist/attributes',
      { name: 'a', value: 'b' },
    ],
    ['delete', '/api/v1/products/does-not-exist/attributes/x'],
    [
      'post',
      '/api/v1/products/does-not-exist/media',
      { url: 'http://x/y.png', type: 'image' },
    ],
    ['delete', '/api/v1/products/does-not-exist/media/x'],
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();

    authDb = app.get<DataSource>(getDataSourceToken('auth'));

    // Seeded the same way `pnpm seed:admin` does it. Nothing else can create
    // the first admin: registration cannot grant a role, and the promote
    // endpoint needs an admin already.
    const authService = app.get<IAuthService>(AUTH_SERVICE, { strict: false });
    await authService.ensureAdmin(adminEmail, password);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: userEmail, password })
      .expect(201);

    adminToken = await login(adminEmail);
    userToken = await login(userEmail);

    const rows = await authDb.query(
      'SELECT id FROM "auth"."users" WHERE email = $1',
      [userEmail],
    );
    plainUserId = rows[0].id;
  }, 30_000);

  afterAll(async () => {
    await authDb.query('DELETE FROM "auth"."users" WHERE email = ANY($1)', [
      [adminEmail, userEmail],
    ]);
    await app
      .get<DataSource>(getDataSourceToken('user'))
      .query('DELETE FROM "user"."user_profiles" WHERE email = ANY($1)', [
        [adminEmail, userEmail],
      ]);
    await app.close();
  });

  const login = async (email: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken;
  };

  describe.each(ADMIN_ONLY)('%s %s', (method, path, body) => {
    it('denies an authenticated non-admin', () =>
      request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${userToken}`)
        .send(body ?? {})
        .expect(403));

    it('lets an admin past the guard', async () => {
      const res = await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body ?? {});

      // Past the guard is the assertion. A 404 for an id that does not exist
      // means the handler ran, which is what distinguishes this from a 403.
      expect(res.status).not.toBe(403);
      expect([200, 201, 204, 404]).toContain(res.status);
    });
  });

  describe('promotion', () => {
    it('refuses a non-admin', () =>
      request(app.getHttpServer())
        .post(`/api/v1/auth/users/${plainUserId}/role`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'admin' })
        .expect(403));

    it('rejects a role outside the domain vocabulary', () =>
      // The runtime check RegisterDto.role never had: it was typed but
      // unvalidated, so any string arriving as JSON was accepted.
      request(app.getHttpServer())
        .post(`/api/v1/auth/users/${plainUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superuser' })
        .expect(400));

    it('lets an admin promote, and the promoted user then passes the guard', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/auth/users/${plainUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200)
        .expect((res) => expect(res.body.role).toBe('admin'));

      // A fresh token, because the old one carries the old role claim.
      const promoted = await login(userEmail);

      await request(app.getHttpServer())
        .post('/api/v1/catalogs')
        .set('Authorization', `Bearer ${promoted}`)
        .send({ name: `promoted-${stamp}` })
        .expect(201);
    });
  });
});
