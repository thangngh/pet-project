import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IUserRepository } from '../../../domain/ports/user-repository.port';
import { User } from '../../../domain/entities/user.entity';
import { UserId } from '../../../domain/value-objects/user-id.value-object';
import { Email } from '../../../domain/value-objects/email.value-object';
import { Password } from '../../../domain/value-objects/password.value-object';
import { TypeOrmUserEntity } from './typeorm-user.entity';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(TypeOrmUserEntity)
    private readonly repo: Repository<TypeOrmUserEntity>,
  ) {}

  async findById(id: UserId): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { id: id.toString() } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { email: email.toString() } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<User[]> {
    const entities = await this.repo.find();
    return entities.map((e) => this.toDomain(e));
  }

  async save(user: User): Promise<void> {
    const entity = this.toPersistence(user);
    await this.repo.save(entity);
    user.clearEvents();
  }

  async delete(id: UserId): Promise<void> {
    await this.repo.delete(id.toString());
  }

  private toDomain(entity: TypeOrmUserEntity): User {
    const userId = new UserId(entity.id);
    const email = new Email(entity.email);
    const password = new Password(entity.password, true);

    return new User(
      userId,
      email,
      password,
      entity.role as 'admin' | 'user',
      entity.isActive,
      entity.createdAt,
      entity.updatedAt,
    );
  }

  private toPersistence(domain: User): TypeOrmUserEntity {
    const entity = new TypeOrmUserEntity();
    entity.id = domain.id.toString();
    entity.email = domain.email.toString();
    entity.password = domain.password.getValue();
    entity.role = domain.role;
    entity.isActive = domain.isActive;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
