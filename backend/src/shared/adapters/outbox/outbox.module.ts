import {
  Module,
  DynamicModule,
  Global,
  OnApplicationBootstrap,
  Inject,
} from '@nestjs/common';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxMessage } from './outbox-message.entity';
import { Outbox } from './outbox';
import { OutboxPoller, OUTBOX_POLLER_DEFAULTS } from './outbox-poller';
import { IntegrationEventDispatcher } from './integration-event-dispatcher';
import { OutboxHealthService } from './outbox-health.service';
import { RequestContextModule } from '../request-context/request-context.module';
import { RequestContextService } from '../request-context/request-context.service';

export const OUTBOX = (context: string) => `OUTBOX_${context.toUpperCase()}`;
export const OUTBOX_POLLER = (context: string) =>
  `OUTBOX_POLLER_${context.toUpperCase()}`;

/**
 * Contexts that produce integration events, and therefore need an outbox.
 *
 * Deliberately not all four. `user` and `product` publish nothing today, and a
 * table nobody writes is the same "exists, connected to nothing" shape this
 * work exists to remove. Adding one later is a migration, and a context that
 * starts publishing without it fails loudly — `relation does not exist` — not
 * silently.
 */
export const OUTBOX_CONTEXTS = ['auth', 'catalog'] as const;

/**
 * The dispatcher is global because handlers self-register into it from every
 * context, and it holds no per-context state.
 */
@Global()
@Module({
  providers: [IntegrationEventDispatcher, OutboxHealthService],
  exports: [IntegrationEventDispatcher, OutboxHealthService],
})
export class IntegrationEventDispatcherModule {}

@Module({})
export class OutboxModule {
  /**
   * Registers one outbox and one poller for a context, on that context's own
   * connection. Nothing here is shared between contexts: under D4 an outbox
   * has to move with the context that owns it.
   */
  static forContext(context: string): DynamicModule {
    const outboxToken = OUTBOX(context);
    const pollerToken = OUTBOX_POLLER(context);

    return {
      module: OutboxModule,
      imports: [
        TypeOrmModule.forFeature([OutboxMessage], context),
        RequestContextModule,
      ],
      providers: [
        {
          provide: outboxToken,
          useFactory: (
            dataSource: DataSource,
            requestContext: RequestContextService,
          ) => new Outbox(dataSource, requestContext),
          inject: [getDataSourceToken(context), RequestContextService],
        },
        {
          // Registering here rather than in the health service keeps the
          // service ignorant of which contexts exist.
          provide: `OUTBOX_HEALTH_REGISTRATION_${context}`,
          useFactory: (health: OutboxHealthService, dataSource: DataSource) => {
            health.register(context, dataSource);
            return true;
          },
          inject: [OutboxHealthService, getDataSourceToken(context)],
        },
        {
          provide: pollerToken,
          useFactory: (
            dataSource: DataSource,
            dispatcher: IntegrationEventDispatcher,
          ) =>
            new OutboxPoller(dataSource, dispatcher, {
              context,
              ...OUTBOX_POLLER_DEFAULTS,
              intervalMs: Number(
                process.env.OUTBOX_POLL_INTERVAL_MS ??
                  OUTBOX_POLLER_DEFAULTS.intervalMs,
              ),
            }),
          inject: [getDataSourceToken(context), IntegrationEventDispatcher],
        },
      ],
      exports: [
        outboxToken,
        pollerToken,
        `OUTBOX_HEALTH_REGISTRATION_${context}`,
      ],
    };
  }
}

/**
 * Starts the pollers once the whole graph is up.
 *
 * On bootstrap rather than in the poller's own constructor: handlers register
 * themselves in `onModuleInit`, and a poller that ran first would find a
 * message with no handler and fail it.
 */
@Module({})
export class OutboxRunnerModule implements OnApplicationBootstrap {
  constructor(
    @Inject(OUTBOX_POLLER('auth')) private readonly authPoller: OutboxPoller,
    @Inject(OUTBOX_POLLER('catalog'))
    private readonly catalogPoller: OutboxPoller,
  ) {}

  static register(): DynamicModule {
    return {
      module: OutboxRunnerModule,
      imports: OUTBOX_CONTEXTS.map((c) => OutboxModule.forContext(c)),
    };
  }

  onApplicationBootstrap(): void {
    if (process.env.OUTBOX_POLLING === 'false') return;

    this.authPoller.start();
    this.catalogPoller.start();
  }
}
