import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/ports/user-repository.port';
import { User } from '../../domain/entities/user.entity';
import { UserId } from '../../domain/value-objects/user-id.value-object';
import { Email } from '../../domain/value-objects/email.value-object';
import { Password } from '../../domain/value-objects/password.value-object';
import { ROLE_ADMIN, UserRole } from '../../domain/constants/role.constants';
import {
  NotFoundError,
  UnauthorizedError,
} from '../../../../shared/domain/errors/domain-error';
import { Outbox } from '../../../../shared/adapters/outbox/outbox';
import { OUTBOX } from '../../../../shared/adapters/outbox/outbox.module';
import { UserSession } from '../../domain/entities/user-session.entity';
import {
  USER_SESSION_REPOSITORY,
  IUserSessionRepository,
} from '../../domain/ports/user-session.repository.port';
import {
  IAuthService,
  AuthTokens,
  RegisterUserInput,
  LoginInput,
  UserProfileOutput,
} from '../ports/auth-service.port';

@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessionRepository: IUserSessionRepository,
    private readonly jwtService: JwtService,
    @Inject(OUTBOX('auth')) private readonly outbox: Outbox,
  ) {}

  async register(input: RegisterUserInput): Promise<AuthTokens> {
    const email = new Email(input.email);

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new UnauthorizedException('Email already registered');
    }

    // Construct from the plaintext FIRST, so the strength rule runs. Both
    // call sites used to hash and then pass hashed: true, which skips
    // validation entirely — the rule existed and never once executed.
    const plaintext = new Password(input.password);
    const password = new Password(await hash(plaintext.getValue(), 10), true);

    const user = User.create(email, password);

    // The user row and its UserCreated message commit together. Publishing
    // after the save left a window where the process could die having created
    // an account with no profile and no record that one was owed.
    await this.outbox.transaction(async (tx) => {
      await this.userRepository.save(user, tx);
      await this.outbox.write(user.events, tx);
    });
    user.clearEvents();

    const tokens = await this.generateTokens(user);
    this.logger.log(`User registered: ${email.toString()}`);
    return tokens;
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const email = new Email(input.email);
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await compare(
      input.password,
      user.password.getValue(),
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async validateUser(userId: string): Promise<User | null> {
    const id = new UserId(userId);
    return this.userRepository.findById(id);
  }

  async getProfile(userId: string): Promise<UserProfileOutput> {
    const id = new UserId(userId);
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id.toString(),
      email: user.email.toString(),
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async setUserRole(
    userId: string,
    role: UserRole,
  ): Promise<UserProfileOutput> {
    const user = await this.userRepository.findById(new UserId(userId));

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    user.changeRole(role);
    await this.userRepository.save(user);
    this.logger.log(`Role changed for user ${userId}: ${role}`);

    return {
      id: user.id.toString(),
      email: user.email.toString(),
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  /**
   * Idempotent by design: the seed runs on every deploy and in CI, and a
   * second run must be a no-op rather than an error or a second admin.
   */
  async ensureAdmin(
    email: string,
    password: string,
  ): Promise<'created' | 'exists'> {
    const emailVo = new Email(email);

    const existing = await this.userRepository.findByEmail(emailVo);
    if (existing) {
      if (existing.role !== ROLE_ADMIN) {
        existing.changeRole(ROLE_ADMIN);
        await this.userRepository.save(existing);
        this.logger.log(`Existing user promoted to admin: ${email}`);
      }
      return 'exists';
    }

    // Validates before hashing, so a weak ADMIN_PASSWORD stops the seed
    // rather than creating an admin nobody intended to be reachable.
    const plaintext = new Password(password);
    const hashed = new Password(await hash(plaintext.getValue(), 10), true);

    const admin = User.create(emailVo, hashed, ROLE_ADMIN);
    await this.outbox.transaction(async (tx) => {
      await this.userRepository.save(admin, tx);
      await this.outbox.write(admin.events, tx);
    });
    admin.clearEvents();

    this.logger.log(`Admin created: ${email}`);
    return 'created';
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const id = new UserId(userId);
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    const isPasswordValid = await compare(
      oldPassword,
      user.password.getValue(),
    );
    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const plaintext = new Password(newPassword);
    user.changePassword(
      new Password(await hash(plaintext.getValue(), 10), true),
    );

    await this.userRepository.save(user);
    this.logger.log(`Password changed for user: ${userId}`);
  }

  /**
   * SHA-256, not bcrypt.
   *
   * bcrypt is for low-entropy secrets a human chose, and it is deliberately
   * not deterministic — which makes it useless here, because a refresh has to
   * *find* the session by the token it was given. A signed JWT is already
   * high-entropy, so a slow KDF buys nothing. What matters is that the stored
   * value is not the token: a leaked sessions table must not be a set of
   * usable credentials.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const accessToken = this.jwtService.sign(
      {
        sub: user.id.toString(),
        email: user.email.toString(),
        role: user.role,
        type: 'access',
      },
      { expiresIn: '15m' },
    );

    // `sid` is what makes each refresh token unique.
    //
    // A JWT's `iat` has one-second granularity, so a payload of {sub, type}
    // alone produces a byte-identical token for two refreshes in the same
    // second — and then the new session's hash equals the old one's, the
    // lookup finds the wrong row, and rotation collapses. Found by a test that
    // rotated twice quickly; no amount of reading would have shown it.
    const sessionId = randomUUID();

    // Carries no role and no email: a refresh token is not a credential for
    // reaching anything, only for obtaining an access token. Before this, both
    // tokens had identical payloads, so a refresh token simply WAS an access
    // token with a seven-day life.
    const refreshToken = this.jwtService.sign(
      { sub: user.id.toString(), type: 'refresh', sid: sessionId },
      { expiresIn: '7d' },
    );

    await this.sessionRepository.save(
      new UserSession(
        sessionId,
        user.id.toString(),
        this.hashToken(refreshToken),
      ),
    );

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string; type?: string };
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedError('Not a refresh token');
    }

    const session = await this.sessionRepository.findByRefreshTokenHash(
      this.hashToken(refreshToken),
    );

    if (!session) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (session.isRevoked) {
      // A revoked session presented again is the one signal a stolen refresh
      // token gives off: the legitimate holder rotated it, and someone still
      // has the old one. Which of the two is the thief is unknowable, so end
      // every session for this user and make them log in again.
      this.logger.warn(
        `Revoked refresh token reused for user ${session.userId} — revoking all sessions`,
      );
      await this.sessionRepository.revokeByUserId(session.userId);
      throw new UnauthorizedError('Refresh token has been revoked');
    }

    if (session.isExpired) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findById(new UserId(session.userId));
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Revoke rather than overwrite the hash. Overwriting would erase the only
    // evidence that the old token ever existed, and with it the ability to
    // detect its reuse above.
    session.revoke();
    await this.sessionRepository.save(session);

    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.sessionRepository.findByRefreshTokenHash(
      this.hashToken(refreshToken),
    );

    // Silent on an unknown token: whether a given token exists is not
    // something an unauthenticated caller should be able to probe for.
    if (!session || session.isRevoked) return;

    session.revoke();
    await this.sessionRepository.save(session);
    this.logger.log(`Session revoked for user ${session.userId}`);
  }
}
