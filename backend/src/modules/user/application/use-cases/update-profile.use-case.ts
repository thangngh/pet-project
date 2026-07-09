import { Injectable, Inject } from '@nestjs/common';
import { USER_PROFILE_REPOSITORY, IUserProfileRepository } from '../../domain/ports/user-profile.repository.port';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ProfileDto } from '../dto/profile.dto';
import { Phone } from '../../domain/value-objects/phone.value-object';

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly repo: IUserProfileRepository,
  ) {}

  async execute(userId: string, dto: UpdateProfileDto): Promise<ProfileDto> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) throw new Error('Profile not found');

    profile.updateProfile(
      dto.firstName,
      dto.lastName,
      dto.phone ? new Phone(dto.phone) : undefined,
      dto.avatar,
    );

    await this.repo.save(profile);

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
