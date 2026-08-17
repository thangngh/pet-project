import { Injectable } from '@nestjs/common';
import {
  OutboxHealthService,
  OutboxHealth,
} from './shared/adapters/outbox/outbox-health.service';

export interface HealthReport {
  status: 'ok' | 'degraded';
  timestamp: string;
  outbox: OutboxHealth['contexts'];
}

@Injectable()
export class AppService {
  constructor(private readonly outboxHealth: OutboxHealthService) {}

  /**
   * Reports the outbox alongside liveness.
   *
   * A stuck outbox does not stop requests succeeding, so without this the
   * system reports itself healthy while two contexts quietly disagree — and
   * the disagreement is only discoverable afterwards by comparing schemas.
   */
  async getHealth(): Promise<HealthReport> {
    const outbox = await this.outboxHealth.check();

    return {
      status: outbox.healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      outbox: outbox.contexts,
    };
  }
}
