import { ValidationError } from '../../../../shared/domain/errors/domain-error';

export class Phone {
  private readonly value: string;

  constructor(value: string) {
    if (!/^\+?[0-9]{7,15}$/.test(value)) {
      throw new ValidationError('Invalid phone number');
    }
    this.value = value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }
}
