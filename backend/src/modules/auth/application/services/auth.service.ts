import { Injectable, Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { IUserRepository, USER_REPOSITORY } from '../../domain/ports/user-repository.port';
import { User } from '../../domain/entities/user.entity';
import { UserId } from '../../domain/value-objects/user-id.value-object';
import { Email } from '../../domain/value-objects/email.value-object';
import { Password } from '../../domain/value-objects/password.value-object';
import { EventBusService } from './event-bus.service';
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

    const hashedPassword = await hash(input.password, 10);
    const password = new Password(hashedPassword, true);

    const user = User.create(email, password, input.role);

    await this.userRepository.save(user);
    await this.eventBusService.publishEvents(user.events);

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

    const isPasswordValid = await compare(input.password, user.password.getValue());
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
