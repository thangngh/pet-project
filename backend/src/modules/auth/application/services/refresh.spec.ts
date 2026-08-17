import { AuthService } from './auth.service';
import { UserSession } from '../../domain/entities/user-session.entity';
import { User } from '../../domain/entities/user.entity';
import { UserId } from '../../domain/value-objects/user-id.value-object';
import { Email } from '../../domain/value-objects/email.value-object';
import { Password } from '../../domain/value-objects/password.value-object';
import { UnauthorizedError } from '../../../../shared/domain/errors/domain-error';

const HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const user = () =>
  new User(
    new UserId('11111111-1111-4111-8111-111111111111'),
    new Email('someone@example.com'),
    new Password(HASH, true),
  );

const deps = () => ({
  userRepository: {
    findByEmail: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(user()),
    save: jest.fn(),
  },
  sessionRepository: {
    save: jest.fn(),
    findByRefreshTokenHash: jest.fn().mockResolvedValue(null),
    revokeByUserId: jest.fn(),
  },
  jwtService: {
    sign: jest.fn().mockImplementation((p) => `signed:${p.type}`),
    verify: jest.fn(),
  },
  eventBus: { publish: jest.fn(), publishEvents: jest.fn() },
});

const build = (d: ReturnType<typeof deps>) =>
  new AuthService(
    d.userRepository as any,
    d.sessionRepository as any,
    d.jwtService as any,
    d.eventBus as any,
  );

const savedSession = (d: ReturnType<typeof deps>, call = 0): UserSession =>
  d.sessionRepository.save.mock.calls[call][0];

describe('AuthService refresh tokens', () => {
  describe('issuing', () => {
    it('stores a hash of the refresh token, never the token', async () => {
      const d = deps();
      const tokens = await build(d).register({
        email: 'someone@example.com',
        password: 'Str0ngPass',
      });

      const session = savedSession(d);
      expect(session.refreshTokenHash).not.toBe(tokens.refreshToken);
      // A leaked sessions table must not be a set of usable credentials.
      expect(session.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('gives the two tokens different payloads', async () => {
      const d = deps();
      await build(d).register({
        email: 'someone@example.com',
        password: 'Str0ngPass',
      });

      const [access, refresh] = d.jwtService.sign.mock.calls.map((c) => c[0]);

      expect(access.type).toBe('access');
      expect(refresh.type).toBe('refresh');

      // Before this, both payloads were identical — so a refresh token WAS an
      // access token with a seven-day life.
      expect(refresh.role).toBeUndefined();
      expect(refresh.email).toBeUndefined();
    });
  });

  describe('exchanging', () => {
    it('rejects a token that is not a refresh token', async () => {
      const d = deps();
      d.jwtService.verify.mockReturnValue({ sub: 'u1', type: 'access' });

      await expect(build(d).refresh('an-access-token')).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('rejects an unknown token', async () => {
      const d = deps();
      d.jwtService.verify.mockReturnValue({ sub: 'u1', type: 'refresh' });

      await expect(build(d).refresh('unknown')).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('rejects an expired session', async () => {
      const d = deps();
      d.jwtService.verify.mockReturnValue({ sub: 'u1', type: 'refresh' });
      d.sessionRepository.findByRefreshTokenHash.mockResolvedValue(
        new UserSession(
          's1',
          'u1',
          'hash',
          undefined,
          undefined,
          new Date(),
          new Date(Date.now() - 1000),
        ),
      );

      await expect(build(d).refresh('stale')).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('revokes the presented session and issues a new pair', async () => {
      const d = deps();
      d.jwtService.verify.mockReturnValue({ sub: 'u1', type: 'refresh' });
      const session = new UserSession('s1', 'u1', 'hash');
      d.sessionRepository.findByRefreshTokenHash.mockResolvedValue(session);

      const tokens = await build(d).refresh('good');

      expect(session.isRevoked).toBe(true);
      expect(tokens.accessToken).toBeDefined();

      // Revoked rather than rotated in place: overwriting the hash would erase
      // the only evidence the old token existed, and with it the ability to
      // notice its reuse.
      expect(d.sessionRepository.save).toHaveBeenCalledTimes(2);
      expect(savedSession(d, 1).id).not.toBe('s1');
    });
  });

  describe('reuse of a revoked token', () => {
    it('ends every session for that user', async () => {
      const d = deps();
      d.jwtService.verify.mockReturnValue({ sub: 'u1', type: 'refresh' });
      const revoked = new UserSession('s1', 'u1', 'hash');
      revoked.revoke();
      d.sessionRepository.findByRefreshTokenHash.mockResolvedValue(revoked);

      await expect(build(d).refresh('stolen')).rejects.toThrow(
        UnauthorizedError,
      );

      // Which of the two holders is the thief is unknowable, so both lose.
      expect(d.sessionRepository.revokeByUserId).toHaveBeenCalledWith('u1');
    });
  });

  describe('logout', () => {
    it('revokes the session behind the token', async () => {
      const d = deps();
      const session = new UserSession('s1', 'u1', 'hash');
      d.sessionRepository.findByRefreshTokenHash.mockResolvedValue(session);

      await build(d).logout('good');

      expect(session.isRevoked).toBe(true);
      expect(d.sessionRepository.save).toHaveBeenCalled();
    });

    it('is silent about an unknown token', async () => {
      const d = deps();

      // Whether a token exists is not something an unauthenticated caller
      // should be able to probe for.
      await expect(build(d).logout('nonsense')).resolves.toBeUndefined();
      expect(d.sessionRepository.save).not.toHaveBeenCalled();
    });
  });
});
