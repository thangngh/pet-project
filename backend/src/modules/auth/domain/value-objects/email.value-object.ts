import { ValidationError } from '../../../../shared/domain/errors/domain-error';

export class Email {
  private readonly value: string;

  constructor(value: string) {
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new ValidationError(`Invalid email address: ${value}`);
    }
    this.value = value.toLowerCase();
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
