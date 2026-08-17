import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { FeatureGateService } from './../src/shared/adapters/feature-gate/feature-gate.service';

/**
 * A disabled feature answers 503 (spec-002 §5).
 *
 * GateException extended plain Error, so GlobalExceptionFilter fell through to
 * its generic branch and returned 500 "Internal server error". Maintenance
 * mode presented as a total failure — the opposite of its purpose, and
 * indistinguishable from a crash.
 *
 * The gate service is overridden rather than driven by environment variables,
 * so both states can be asserted in one CI run.
 */
describe('feature gates (e2e)', () => {
  const build = async (gate: Partial<FeatureGateService>) => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FeatureGateService)
      .useValue({
        isEnabled: () => true,
        isApiLocked: () => false,
        getMetadata: (feature: string) => ({ feature }),
        ...gate,
      })
      .compile();

    const app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
    return app;
  };

  describe('a disabled feature', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await build({ isEnabled: () => false });
    }, 30_000);

    afterAll(() => app.close());

    it('answers 503, not 500 — unavailable is not broken', () =>
      request(app.getHttpServer()).get('/api/v1/catalogs/tree').expect(503));

    it('names itself, so a client can distinguish it from any other 503', () =>
      // The filter flattens a response to statusCode/message/timestamp/path.
      // Without carrying the extra fields through, `code` and `feature` would
      // be set on the exception and dropped before the client saw them.
      request(app.getHttpServer())
        .get('/api/v1/catalogs/tree')
        .expect(503)
        .expect((res) => {
          expect(res.body.code).toBe('FEATURE_DISABLED');
          expect(res.body.feature).toBe('productCatalog');
        }));
  });

  describe('maintenance mode', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await build({ isApiLocked: () => true });
    }, 30_000);

    afterAll(() => app.close());

    it('locks an ordinary endpoint with its own code', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'someone@example.com', password: 'Str0ngPass' })
        .expect(503)
        .expect((res) => expect(res.body.code).toBe('API_LOCKED')));

    it('leaves /health answering 200', () =>
      // A maintenance mode that fails the liveness probe gets the process
      // restarted by the orchestrator, which is not maintenance.
      request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => expect(res.body.status).toBe('ok')));
  });
});
