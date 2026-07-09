import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmUserProfile } from './typeorm-user-profile.entity';
import { UserProfile } from '../../../domain/entities/user-profile.entity';
import { IUserProfileRepository } from '../../../domain/ports/user-profile.repository.port';
import { Phone } from '../../../domain/value-objects/phone.value-object';

@Injectable()
export class UserProfileRepository implements IUserProfileRepository {
  constructor(
    @InjectRepository(TypeOrmUserProfile) private readonly repo: Repository<TypeOrmUserProfile>,
  ) {}

  async save(profile: UserProfile): Promise<void> {
    const entity = this.toTypeOrm(profile);
    await this.repo.save(entity);
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const entity = await this.repo.findOne({ where: { userId } });
    return entity ? this.toDomain(entity) : null;
  }

  private toTypeOrm(domain: UserProfile): TypeOrmUserProfile {
    const entity = new TypeOrmUserProfile();
    entity.userId = domain.userId;
    entity.firstName = domain.firstName;
    entity.lastName = domain.lastName;
    entity.email = domain.email;
    entity.phone = domain.phone?.toString();
    entity.avatar = domain.avatar;
    entity.status = domain.status;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    entity.version = domain.version;
    return entity;
  }

  private toDomain(entity: TypeOrmUserProfile): UserProfile {
    return new UserProfile(
      entity.userId,
      entity.firstName,
      entity.lastName,
      entity.email,
      entity.phone ? new Phone(entity.phone) : undefined,
      entity.avatar,
      entity.status as any,
      entity.createdAt,
      entity.updatedAt,
      entity.version,
    );
  }
}
