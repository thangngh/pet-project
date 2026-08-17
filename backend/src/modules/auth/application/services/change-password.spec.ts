import { hash } from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../../domain/entities/user.entity';
import { UserId } from '../../domain/value-objects/user-id.value-object';
import { Email } from '../../domain/value-objects/email.value-object';
import { Password } from '../../domain/value-objects/password.value-object';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../../shared/domain/errors/domain-error';

/**
 * Rewritten against AuthService (D16). It used to test ChangePasswordUseCase
 * in the User context, which delegated to an adapter, which delegated to a
 * port, which called this method — three layers whose only purpose was
 * crossing a context boundary. All three are deleted; the HTTP path is
 * unchanged, which is the point.
 */
describe('AuthService.changePassword', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const currentPassword = 'Curr3ntPass';

  const existingUser = async () =>
    new User(
      new UserId(userId),
      new Email('someone@example.com'),
      new Password(await hash(currentPassword, 10), true),
    );

  const deps = (user?: User) => ({
    userRepository: {
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(user ?? null),
      save: jest.fn(),
    },
    sessionRepository: {
      save: jest.fn(),
      findByRefreshTokenHash: jest.fn().mockResolvedValue(null),
      revokeByUserId: jest.fn(),
    },
    jwtService: { sign: jest.fn().mockReturnValue('token'), verify: jest.fn() },
    outbox: {
      transaction: jest.fn(async (work: any) => work({ __tx: true })),
      write: jest.fn(),
    },
  });

  const build = (d: ReturnType<typeof deps>) =>
    new AuthService(
      d.userRepository as any,
      d.sessionRepository as any,
      d.jwtService as any,
      d.outbox as any,
    );

  it('replaces the stored hash when the current password is right', async () => {
    const d = deps(await existingUser());

    await build(d).changePassword(userId, currentPassword, 'N3wStrongPass');

    const saved: User = d.userRepository.save.mock.calls[0][0];
    expect(saved.password.isHashed()).toBe(true);
    expect(saved.password.getValue()).not.toBe('N3wStrongPass');
  });

  it('rejects a wrong current password without writing anything', async () => {
    const d = deps(await existingUser());

    await expect(
      build(d).changePassword(userId, 'WrongPass1', 'N3wStrongPass'),
    ).rejects.toThrow(UnauthorizedError);

    expect(d.userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a weak new password', async () => {
    const d = deps(await existingUser());

    // The strength rule reaches this path too: it lives in the value object,
    // which is constructed from the plaintext before hashing.
    await expect(
      build(d).changePassword(userId, currentPassword, 'weak'),
    ).rejects.toThrow(ValidationError);

    expect(d.userRepository.save).not.toHaveBeenCalled();
  });

  it('reports an unknown user', async () => {
    const d = deps();

    await expect(
      build(d).changePassword(userId, currentPassword, 'N3wStrongPass'),
    ).rejects.toThrow(NotFoundError);
  });

  it('refuses a deactivated account', async () => {
    const user = await existingUser();
    user.deactivate();
    const d = deps(user);

    await expect(
      build(d).changePassword(userId, currentPassword, 'N3wStrongPass'),
    ).rejects.toThrow(UnauthorizedError);
  });
});
