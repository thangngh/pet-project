import { User } from '../entities/user.entity';
import { UserId } from '../value-objects/user-id.value-object';
import { Email } from '../value-objects/email.value-object';

export const USER_REPOSITORY = 'USER_REPOSITORY';

export interface IUserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findAll(): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
}
