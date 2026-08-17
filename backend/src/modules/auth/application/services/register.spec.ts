import { AuthService } from './auth.service';
import { User } from '../../domain/entities/user.entity';

const deps = () => ({
  userRepository: {
    findByEmail: jest.fn().mockResolvedValue(null),
    findById: jest.fn(),
    save: jest.fn(),
  },
  jwtService: { sign: jest.fn().mockReturnValue('token') },
  eventBus: { publish: jest.fn(), publishEvents: jest.fn() },
});

const build = (d: ReturnType<typeof deps>) =>
  new AuthService(
    d.userRepository as any,
    d.jwtService as any,
    d.eventBus as any,
  );

const savedUser = (d: ReturnType<typeof deps>): User =>
  d.userRepository.save.mock.calls[0][0];

describe('AuthService.register', () => {
  it('creates a plain user', async () => {
    const d = deps();
    await build(d).register({
      email: 'someone@example.com',
      password: 'Str0ngPass',
    });

    expect(savedUser(d).role).toBe('user');
  });

  // Registration is public. It used to accept a role and pass it straight into
  // the aggregate, so a caller could hand themselves 'admin'. The field is
  // gone; this asserts the body cannot smuggle one back in.
  it('ignores a role supplied by the caller', async () => {
    const d = deps();
    await build(d).register({
      email: 'someone@example.com',
      password: 'Str0ngPass',
      role: 'admin',
    } as any);

    expect(savedUser(d).role).toBe('user');
    expect(savedUser(d).role).not.toBe('admin');
  });

  it('publishes UserCreated and clears the aggregate afterwards', async () => {
    const d = deps();
    await build(d).register({
      email: 'someone@example.com',
      password: 'Str0ngPass',
    });

    expect(d.eventBus.publishEvents).toHaveBeenCalledTimes(1);
    expect(d.eventBus.publishEvents.mock.calls[0][0]).toHaveLength(1);
    expect(savedUser(d).events).toHaveLength(0);
  });
});
