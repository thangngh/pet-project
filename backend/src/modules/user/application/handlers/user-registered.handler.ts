import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UserCreatedEvent } from '../../domain/entities/user-created.event';
import { USER_PROFILE_REPOSITORY, IUserProfileRepository } from '../../domain/ports/user-profile.repository.port';
import { UserProfile } from '../../domain/entities/user-profile.entity';

@EventsHandler(UserCreatedEvent)
export class UserRegisteredHandler implements IEventHandler<UserCreatedEvent> {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly repo: IUserProfileRepository,
  ) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    const profile = UserProfile.create(event.userId, event.email);
    profile.activate();
    await this.repo.save(profile);
  }
}
