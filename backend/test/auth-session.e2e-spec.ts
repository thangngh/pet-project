import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * Sessions, refresh rotation and logout (spec-002 §6).
 *
 * All the machinery for this — UserSession with revoke() and rotate(), a
 * repository with findByRefreshTokenHash and revokeByUserId — was written
 * long ago and called by nothing. A "refresh token" was an access token with
 * a seven-day life: same payload, same secret, accepted everywhere.
 */
describe('sessions and refresh (e2e)', () => {
  let app: INestApplication;
  let authDb: DataSource;

  const email = `session-${Date.now()}@example.com`;
  const password = 'Str0ngPass';

  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();

    authDb = app.get<DataSource>(getDataSourceToken('auth'));

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);

    refreshToken = res.body.refreshToken;
  }, 30_000);

  afterAll(async () => {
    const rows = await authDb.query(
      'SELECT id FROM "auth"."users" WHERE email = $1',
      [email],
    );
    if (rows.length) {
      await authDb.query(
        'DELETE FROM "auth"."user_sessions" WHERE "userId" = $1',
        [rows[0].id],
      );
      await authDb.query('DELETE FROM "auth"."users" WHERE id = $1', [
        rows[0].id,
      ]);
      await app
        .get<DataSource>(getDataSourceToken('user'))
        .query('DELETE FROM "user"."user_profiles" WHERE "userId" = $1', [
          rows[0].id,
        ]);
    }
    await app.close();
  });

  it('stores a hash of the refresh token, never the token', async () => {
    const rows = await authDb.query(
      'SELECT "refreshTokenHash" FROM "auth"."user_sessions" ORDER BY "createdAt" DESC LIMIT 1',
    );

    expect(rows[0].refreshTokenHash).not.toBe(refreshToken);
    expect(rows[0].refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('refuses a refresh token presented as an access token', () =>
    // Signed with the same secret, so without the `type` claim check this
    // authenticated every endpoint for seven days.
    request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(401));

  it('rotates the pair, and the new access token works', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));

    // Two refreshes in the same second used to produce a byte-identical
    // token, because the payload was {sub, type} and `iat` has one-second
    // granularity. The session id in the payload is what makes each unique;
    // without it the new session's hash equalled the old one's and rotation
    // silently collapsed.
    expect(res.body.refreshToken).not.toBe(refreshToken);

    // Auth's own profile, not /me: since the outbox landed, the user profile
    // is created by a poller and is eventually consistent, so a read of /me
    // straight after registering can legitimately 404. This test is about
    // tokens.
    await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);

    refreshToken = res.body.refreshToken;
  });

  it('treats reuse of a rotated token as a compromise and ends every session', async () => {
    const userId = (
      await authDb.query('SELECT id FROM "auth"."users" WHERE email = $1', [
        email,
      ])
    )[0].id;

    const live = async (): Promise<number> =>
      (
        await authDb.query(
          'SELECT count(*)::int AS n FROM "auth"."user_sessions" WHERE "userId" = $1 AND "revokedAt" IS NULL',
          [userId],
        )
      )[0].n;

    // A session to rotate, and a second, unrelated one that must also die.
    const victim = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const bystander = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: victim.body.refreshToken })
      .expect(200);

    expect(await live()).toBeGreaterThan(0);

    // Replaying the rotated token is the one signal a stolen refresh token
    // gives off. Which holder is the thief is unknowable, so both lose.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: victim.body.refreshToken })
      .expect(401);

    expect(await live()).toBe(0);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: bystander.body.refreshToken })
      .expect(401);
  });

  it('logout makes the session unusable', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: res.body.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: res.body.refreshToken })
      .expect(401);
  });

  it('change-password keeps its path after moving to AuthController', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    // The whole point of D16: the operation moved contexts, the URL did not.
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .send({ oldPassword: password, newPassword: 'N3wStrongPass' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'N3wStrongPass' })
      .expect(200);
  });
});
