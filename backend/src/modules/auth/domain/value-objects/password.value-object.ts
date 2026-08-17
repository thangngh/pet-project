import { ValidationError } from '../../../../shared/domain/errors/domain-error';

export class Password {
  private readonly value: string;
  private readonly hashed: boolean;

  /**
   * `hashed: true` means "this is a stored hash being rehydrated", and skips
   * the strength rule because a bcrypt digest cannot satisfy it.
   *
   * It is not a way to accept a password without checking it. Both callers
   * used to hash first and then pass `true`, so the strength rule never ran
   * for anyone; they now construct from the plaintext first and hash after.
   */
  constructor(value: string, hashed = false) {
    if (!hashed && !this.isStrongPassword(value)) {
      throw new ValidationError(
        'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number',
      );
    }
    if (value.trim().length === 0) {
      throw new ValidationError('Password cannot be empty');
    }
    this.value = value;
    this.hashed = hashed;
  }

  private isStrongPassword(password: string): boolean {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
    );
  }

  getValue(): string {
    return this.value;
  }

  isHashed(): boolean {
    return this.hashed;
  }

  equals(other: Password): boolean {
    return this.value === other.value;
  }
}
