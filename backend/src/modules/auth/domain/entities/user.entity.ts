import { DomainEvent } from '../../../../shared/adapters/event-bus/domain-event';
import { UserId } from '../value-objects/user-id.value-object';
import { Email } from '../value-objects/email.value-object';
import { Password } from '../value-objects/password.value-object';
import { UserCreatedEvent } from './user-created.event';

export type UserRole = 'admin' | 'user';

export class User {
  private readonly _id: UserId;
  private _email: Email;
  private _password: Password;
  private _role: UserRole;
  private _isActive: boolean;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _events: DomainEvent[] = [];

  constructor(
    id: UserId,
    email: Email,
    password: Password,
    role: UserRole = 'user',
    isActive = true,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    this._id = id;
    this._email = email;
    this._password = password;
    this._role = role;
    this._isActive = isActive;
    this._createdAt = createdAt || new Date();
    this._updatedAt = updatedAt || new Date();
  }

  static create(email: Email, password: Password, role: UserRole = 'user'): User {
    const id = new UserId(crypto.randomUUID());
    const user = new User(id, email, password, role);
    user.addEvent(new UserCreatedEvent(id, email));
    return user;
  }

  get id(): UserId { return this._id; }
  get email(): Email { return this._email; }
  get password(): Password { return this._password; }
  get role(): UserRole { return this._role; }
  get isActive(): boolean { return this._isActive; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get events(): DomainEvent[] { return [...this._events]; }

  clearEvents(): void { this._events = []; }

  private addEvent(event: DomainEvent): void {
    this._events.push(event);
  }

  deactivate(): void { this._isActive = false; this._updatedAt = new Date(); }
  activate(): void { this._isActive = true; this._updatedAt = new Date(); }
  changePassword(newPassword: Password): void { this._password = newPassword; this._updatedAt = new Date(); }
  changeEmail(newEmail: Email): void { this._email = newEmail; this._updatedAt = new Date(); }
}
