import { ValidationError } from '../../../../shared/domain/errors/domain-error';

export class UserId {
  private readonly value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new ValidationError('UserId cannot be empty');
    }
    this.value = value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }
}
