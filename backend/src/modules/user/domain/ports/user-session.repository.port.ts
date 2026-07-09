import { UserSession } from '../entities/user-session.entity';

export const USER_SESSION_REPOSITORY = 'USER_SESSION_REPOSITORY';

export interface IUserSessionRepository {
  save(session: UserSession): Promise<void>;
  findByRefreshTokenHash(hash: string): Promise<UserSession | null>;
  revokeByUserId(userId: string, exceptSessionId?: string): Promise<void>;
}
