import { AuthService } from './auth.service';
import { User } from '../../domain/entities/user.entity';

const deps = () => ({
  userRepository: {
    findByEmail: jest.fn().mockResolvedValue(null),
    findById: jest.fn(),
    save: jest.fn(),
  },
  sessionRepository: {
    save: jest.fn(),
    findByRefreshTokenHash: jest.fn().mockResolvedValue(null),
    revokeByUserId: jest.fn(),
  },
  jwtService: { sign: jest.fn().mockReturnValue('token') },
  eventBus: { publish: jest.fn(), publishEvents: jest.fn() },
});

const build = (d: ReturnType<typeof deps>) =>
  new AuthService(
    d.userRepository as any,
    d.sessionRepository as any,
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

  // The case a DTO cannot cover. The global ValidationPipe gives a good 400 at
  // the HTTP boundary, but AuthService can be called with no DTO in sight —
  // by the admin seed, by a future use case, by a test. The rule has to be
  // unskippable in the value object too, so it runs for every caller.
  describe('password strength, with no DTO involved', () => {
    it.each(['a', 'short', 'nouppercase1', 'NoDigitsHere'])(
      'rejects %p',
      async (password) => {
        const d = deps();
        await expect(
          build(d).register({ email: 'someone@example.com', password }),
        ).rejects.toThrow(/password/i);

        expect(d.userRepository.save).not.toHaveBeenCalled();
      },
    );

    it('stores a hash, never the plaintext', async () => {
      const d = deps();
      await build(d).register({
        email: 'someone@example.com',
        password: 'Str0ngPass',
      });

      const stored = savedUser(d).password;
      expect(stored.getValue()).not.toBe('Str0ngPass');
      expect(stored.isHashed()).toBe(true);
      expect(stored.getValue()).toMatch(/^\$2[aby]\$/);
    });
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
