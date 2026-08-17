import { User } from '../../domain/entities/user.entity';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Registration is public, so it never accepts a role: the aggregate's default
// applies. Promoting a user is a separate, authorised operation.
export interface RegisterUserInput {
  email: string;
  password: string;
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
  changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void>;
}
