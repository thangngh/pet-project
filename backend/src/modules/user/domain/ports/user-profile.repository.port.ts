import { UserProfile } from '../entities/user-profile.entity';

export const USER_PROFILE_REPOSITORY = 'USER_PROFILE_REPOSITORY';

export interface IUserProfileRepository {
  save(profile: UserProfile): Promise<void>;
  findByUserId(userId: string): Promise<UserProfile | null>;
}
