import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { IntegrationEventDispatcher } from '../../../../shared/adapters/outbox/integration-event-dispatcher';
import { UserCreatedEvent } from '../../../../shared/adapters/event-bus/integration-events/user-created.event';
import {
  USER_PROFILE_REPOSITORY,
  IUserProfileRepository,
} from '../../domain/ports/user-profile.repository.port';
import { UserProfile } from '../../domain/entities/user-profile.entity';

@EventsHandler(UserCreatedEvent)
export class UserRegisteredHandler
  implements IEventHandler<UserCreatedEvent>, OnModuleInit
{
  private readonly logger = new Logger(UserRegisteredHandler.name);

  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly repo: IUserProfileRepository,
    private readonly dispatcher: IntegrationEventDispatcher,
  ) {}

  /**
   * Registers with the dispatcher the outbox poller awaits.
   *
   * @EventsHandler stays for the in-process bus, but the outbox path cannot
   * use it: EventBus.publish returns void and runs handlers detached, so a
   * message would be marked delivered whether or not this ran.
   */
  onModuleInit(): void {
    this.dispatcher.register(UserCreatedEvent, this);
  }

  /**
   * Idempotent, because an outbox delivers at least once (spec-003).
   *
   * This used to create and save unconditionally. A redelivery would then
   * overwrite a profile the user had since filled in — replacing their name
   * with empty strings and their status with the initial one. Silent data
   * loss, and only on the retry path, which is the path least likely to be
   * exercised before production.
   *
   * `userId` is already the profile's primary key, so a check-then-create is
   * enough here and an inbox table would be more machinery than two handlers
   * justify. Revisit if a handler appears that cannot be made naturally
   * idempotent.
   */
  async handle(event: UserCreatedEvent): Promise<void> {
    const existing = await this.repo.findByUserId(event.userId);
    if (existing) {
      this.logger.debug(
        `Profile already exists for ${event.userId} — redelivery ignored`,
      );
      return;
    }

    const profile = UserProfile.create(event.userId, event.email);
    profile.activate();
    await this.repo.save(profile);
  }
}
