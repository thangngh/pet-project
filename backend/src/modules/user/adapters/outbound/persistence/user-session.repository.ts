import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmUserSession } from './typeorm-user-session.entity';
import { UserSession } from '../../../domain/entities/user-session.entity';
import { IUserSessionRepository } from '../../../domain/ports/user-session.repository.port';

@Injectable()
export class UserSessionRepository implements IUserSessionRepository {
  constructor(
    @InjectRepository(TypeOrmUserSession) private readonly repo: Repository<TypeOrmUserSession>,
  ) {}

  async save(session: UserSession): Promise<void> {
    const entity = this.toTypeOrm(session);
    await this.repo.save(entity);
  }

  async findByRefreshTokenHash(hash: string): Promise<UserSession | null> {
    const entity = await this.repo.findOne({ where: { refreshTokenHash: hash } });
    return entity ? this.toDomain(entity) : null;
  }

  async revokeByUserId(userId: string, exceptSessionId?: string): Promise<void> {
    const query: any = { userId };
    if (exceptSessionId) {
      await this.repo
        .createQueryBuilder()
        .update(TypeOrmUserSession)
        .set({ revokedAt: new Date() })
        .where('userId = :userId AND id != :exceptSessionId', { userId, exceptSessionId })
        .execute();
    } else {
      await this.repo.update({ userId }, { revokedAt: new Date() });
    }
  }

  private toTypeOrm(domain: UserSession): TypeOrmUserSession {
    const entity = new TypeOrmUserSession();
    entity.id = domain.id;
    entity.userId = domain.userId;
    entity.refreshTokenHash = domain.refreshTokenHash;
    entity.userAgent = domain.userAgent;
    entity.ip = domain.ip;
    entity.createdAt = domain.createdAt;
    entity.expiresAt = domain.expiresAt;
    entity.revokedAt = domain.revokedAt;
    return entity;
  }

  private toDomain(entity: TypeOrmUserSession): UserSession {
    return new UserSession(
      entity.id,
      entity.userId,
      entity.refreshTokenHash,
      entity.userAgent,
      entity.ip,
      entity.createdAt,
      entity.expiresAt,
      entity.revokedAt,
    );
  }
}
