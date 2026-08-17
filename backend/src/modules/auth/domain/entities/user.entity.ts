import { DomainEvent } from '../../../../shared/adapters/event-bus/domain-event';
import { UserId } from '../value-objects/user-id.value-object';
import { Email } from '../value-objects/email.value-object';
import { Password } from '../value-objects/password.value-object';
import { UserCreatedEvent } from '../../../../shared/adapters/event-bus/integration-events/user-created.event';
import { ROLE_USER, UserRole } from '../constants/role.constants';

export { UserRole };

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
    role: UserRole = ROLE_USER,
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

  static create(
    email: Email,
    password: Password,
    role: UserRole = ROLE_USER,
  ): User {
    const id = new UserId(crypto.randomUUID());
    const user = new User(id, email, password, role);
    user.addEvent(new UserCreatedEvent(id.toString(), email.toString()));
    return user;
  }

  get id(): UserId {
    return this._id;
  }
  get email(): Email {
    return this._email;
  }
  get password(): Password {
    return this._password;
  }
  get role(): UserRole {
    return this._role;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get events(): DomainEvent[] {
    return [...this._events];
  }

  clearEvents(): void {
    this._events = [];
  }

  private addEvent(event: DomainEvent): void {
    this._events.push(event);
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }
  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }
  changePassword(newPassword: Password): void {
    this._password = newPassword;
    this._updatedAt = new Date();
  }
  changeEmail(newEmail: Email): void {
    this._email = newEmail;
    this._updatedAt = new Date();
  }

  /**
   * The only way a user's role changes after creation.
   *
   * Registration cannot set a role — that is how a public endpoint used to be
   * able to grant itself admin. Reaching this method requires an authorised
   * caller, checked at the controller.
   */
  changeRole(newRole: UserRole): void {
    if (this._role === newRole) return;
    this._role = newRole;
    this._updatedAt = new Date();
  }
}
