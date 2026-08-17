import { UserRegisteredHandler } from './user-registered.handler';
import { UserCreatedEvent } from '../../../../shared/adapters/event-bus/integration-events/user-created.event';
import { UserProfile } from '../../domain/entities/user-profile.entity';

describe('UserRegisteredHandler', () => {
  const dispatcher = { register: jest.fn(), dispatch: jest.fn() };

  const event = new UserCreatedEvent('u1', 'someone@example.com');

  const repo = () => ({
    save: jest.fn(),
    findByUserId: jest.fn().mockResolvedValue(null),
  });

  it('creates an active profile on first delivery', async () => {
    const r = repo();

    await new UserRegisteredHandler(r as any, dispatcher as any).handle(event);

    const saved: UserProfile = r.save.mock.calls[0][0];
    expect(saved.userId).toBe('u1');
    expect(saved.email).toBe('someone@example.com');
    expect(saved.status).toBe('active');
  });

  describe('at-least-once delivery', () => {
    it('ignores a redelivery rather than overwriting the profile', async () => {
      // An outbox delivers at least once. This handler used to create and save
      // unconditionally, so a retry would replace a filled-in profile with the
      // initial empty one — silent data loss, on the path least likely to be
      // exercised before production.
      const r = repo();
      const filledIn = UserProfile.create('u1', 'someone@example.com');
      filledIn.activate();
      filledIn.updateProfile('Ada', 'Lovelace');
      r.findByUserId.mockResolvedValue(filledIn);

      await new UserRegisteredHandler(r as any, dispatcher as any).handle(
        event,
      );

      expect(r.save).not.toHaveBeenCalled();
      expect(filledIn.firstName).toBe('Ada');
    });

    it('leaves the same state after two deliveries as after one', async () => {
      const r = repo();

      await new UserRegisteredHandler(r as any, dispatcher as any).handle(
        event,
      );
      const created: UserProfile = r.save.mock.calls[0][0];

      r.findByUserId.mockResolvedValue(created);
      await new UserRegisteredHandler(r as any, dispatcher as any).handle(
        event,
      );

      expect(r.save).toHaveBeenCalledTimes(1);
    });
  });
});
