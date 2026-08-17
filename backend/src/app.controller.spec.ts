import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OutboxHealthService } from './shared/adapters/outbox/outbox-health.service';

describe('AppController', () => {
  const outboxHealth = { check: jest.fn() };

  const build = async (): Promise<AppController> => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: OutboxHealthService, useValue: outboxHealth },
      ],
    }).compile();

    return app.get<AppController>(AppController);
  };

  beforeEach(() => jest.clearAllMocks());

  describe('health', () => {
    it('reports ok with a drained outbox', async () => {
      outboxHealth.check.mockResolvedValue({
        healthy: true,
        contexts: {
          auth: {
            undispatched: 0,
            stale: 0,
            abandoned: 0,
            oldestUndispatchedAt: null,
          },
        },
      });

      const result = await (await build()).getHealth();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.outbox.auth.undispatched).toBe(0);
    });

    it('reports degraded when messages are stuck', async () => {
      outboxHealth.check.mockResolvedValue({
        healthy: false,
        contexts: {
          auth: {
            undispatched: 4,
            stale: 4,
            abandoned: 1,
            oldestUndispatchedAt: '2026-08-17T00:00:00.000Z',
          },
        },
      });

      const result = await (await build()).getHealth();

      // Degraded in the body, still HTTP 200 — deliberately.
      //
      // /health is the liveness probe. Failing it gets the process restarted,
      // and a restart cannot unstick an outbox: the messages are in the
      // database, not in memory. It would flap instead, which is the same
      // mistake as maintenance mode failing liveness (spec-002 §5).
      //
      // A readiness check or an alert reads `status` and acts. spec-003 §4
      // asked for "a failing health check"; this reports the failure without
      // asking the orchestrator to respond to it by killing things.
      expect(result.status).toBe('degraded');
      expect(result.outbox.auth.stale).toBe(4);
      expect(result.outbox.auth.abandoned).toBe(1);
    });
  });
});
