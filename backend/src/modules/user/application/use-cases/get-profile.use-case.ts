import { Injectable, Inject } from '@nestjs/common';
import {
  USER_PROFILE_REPOSITORY,
  IUserProfileRepository,
} from '../../domain/ports/user-profile.repository.port';
import { NotFoundError } from '../../../../shared/domain/errors/domain-error';
import { ProfileDto } from '../dto/profile.dto';

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly repo: IUserProfileRepository,
  ) {}

  async execute(userId: string): Promise<ProfileDto> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Profile', userId);
    }
    return new ProfileDto(
      profile.userId,
      profile.firstName,
      profile.lastName,
      profile.email,
      profile.status,
      profile.createdAt,
      profile.updatedAt,
      profile.phone?.toString(),
      profile.avatar,
    );
  }
}
