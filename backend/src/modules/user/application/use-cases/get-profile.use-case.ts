import { Injectable, Inject } from '@nestjs/common';
import { USER_PROFILE_REPOSITORY, IUserProfileRepository } from '../../domain/ports/user-profile.repository.port';
import { ProfileDto } from '../dto/profile.dto';

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly repo: IUserProfileRepository,
  ) {}

  async execute(userId: string): Promise<ProfileDto> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) {
      throw new Error('Profile not found');
    }
    return new ProfileDto(
      profile.userId,
      profile.firstName,
      profile.lastName,
      profile.email,
      profile.phone?.toString(),
      profile.avatar,
      profile.status,
      profile.createdAt,
      profile.updatedAt,
    );
  }
}
