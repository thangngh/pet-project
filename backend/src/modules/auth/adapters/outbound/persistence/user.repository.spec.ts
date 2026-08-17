import { Repository } from 'typeorm';
import { UserRepository } from './user.repository';
import { TypeOrmUserEntity } from './typeorm-user.entity';
import { User } from '../../../domain/entities/user.entity';
import { Email } from '../../../domain/value-objects/email.value-object';
import { Password } from '../../../domain/value-objects/password.value-object';

/**
 * A repository persists. It does not decide when an aggregate's events have
 * been dealt with.
 *
 * `save` used to call `user.clearEvents()`, so by the time the use case
 * reached `publishEvents(user.events)` the array was empty. Every
 * UserCreated event was dropped in silence and no profile was ever created —
 * against a real database, registration half-worked and reported success.
 *
 * PR #3's integration test could not catch this: it published through the bus
 * with a stubbed repository, which is precisely the component that was
 * discarding the events.
 */
describe('UserRepository', () => {
  const typeOrmRepo = {
    save: jest.fn().mockResolvedValue(undefined),
  } as unknown as Repository<TypeOrmUserEntity>;

  const repository = new UserRepository(typeOrmRepo);

  const newUser = () =>
    User.create(
      new Email('someone@example.com'),
      new Password('$2b$10$abcdefghijklmnopqrstuv', true),
    );

  it('leaves the aggregate its events, so the use case can publish them', async () => {
    const user = newUser();
    expect(user.events).toHaveLength(1);

    await repository.save(user);

    expect(user.events).toHaveLength(1);
    expect(user.events[0].eventName).toBe('UserCreatedEvent');
  });

  it('still writes the row', async () => {
    await repository.save(newUser());
    expect(typeOrmRepo.save).toHaveBeenCalled();
  });
});
