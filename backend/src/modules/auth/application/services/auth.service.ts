import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
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
import { EventBusService } from '../../../../shared/adapters/event-bus/event-bus.service';
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
    private readonly jwtService: JwtService,
    private readonly eventBusService: EventBusService,
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

    await this.userRepository.save(user);
    await this.eventBusService.publishEvents(user.events);
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
    await this.userRepository.save(admin);
    await this.eventBusService.publishEvents(admin.events);
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

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload = {
      sub: user.id.toString(),
      email: user.email.toString(),
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }
}
