export class Password {
  private readonly value: string;
  private readonly hashed: boolean;

  constructor(value: string, hashed = false) {
    if (!hashed && !this.isStrongPassword(value)) {
      throw new Error(
        'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number',
      );
    }
    if (value.trim().length === 0) {
      throw new Error('Password cannot be empty');
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
