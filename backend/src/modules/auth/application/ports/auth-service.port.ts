import { User } from '../../domain/entities/user.entity';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  role?: 'admin' | 'user';
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UserProfileOutput {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export const AUTH_SERVICE = 'AUTH_SERVICE';

export interface IAuthService {
  register(input: RegisterUserInput): Promise<AuthTokens>;
  login(input: LoginInput): Promise<AuthTokens>;
  validateUser(userId: string): Promise<User | null>;
  getProfile(userId: string): Promise<UserProfileOutput>;
}
