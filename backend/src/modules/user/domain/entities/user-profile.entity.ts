import { Phone } from '../value-objects/phone.value-object';

export type UserStatus = 'active' | 'inactive';

export class UserProfile {
  constructor(
    public readonly userId: string,
    public firstName: string,
    public lastName: string,
    public email: string,
    public phone?: Phone,
    public avatar?: string,
    public status: UserStatus = 'inactive',
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public version: number = 1,
  ) {}

  static create(userId: string, email: string): UserProfile {
    return new UserProfile(userId, '', '', email);
  }

  updateProfile(
    firstName?: string,
    lastName?: string,
    phone?: Phone,
    avatar?: string,
  ): void {
    if (firstName !== undefined) this.firstName = firstName;
    if (lastName !== undefined) this.lastName = lastName;
    if (phone !== undefined) this.phone = phone;
    if (avatar !== undefined) this.avatar = avatar;
    this.updatedAt = new Date();
  }

  activate(): void {
    this.status = 'active';
  }

  deactivate(): void {
    this.status = 'inactive';
  }
}
