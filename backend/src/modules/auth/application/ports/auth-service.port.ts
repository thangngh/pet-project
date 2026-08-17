import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/constants/role.constants';

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

  /**
   * Promote or demote a user. Authorisation is the caller's job — the
   * controller gates it with @Roles(ROLE_ADMIN); this only enforces that the
   * user exists.
   */
  setUserRole(userId: string, role: UserRole): Promise<UserProfileOutput>;

  /**
   * Creates the admin if no user holds that email, and does nothing if one
   * already does. Used by the seed (pnpm seed:admin) to solve the bootstrap:
   * nothing else can create the first admin, because promoting requires one.
   */
  ensureAdmin(email: string, password: string): Promise<'created' | 'exists'>;
}
