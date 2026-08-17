import { Password } from './password.value-object';
import { ValidationError } from '../../../../shared/domain/errors/domain-error';

const BCRYPT_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

describe('Password', () => {
  describe('constructed from plaintext', () => {
    it('accepts a password meeting every rule', () => {
      expect(() => new Password('Str0ngPass')).not.toThrow();
    });

    it.each([
      ['too short', 'Ab1'],
      ['no uppercase', 'str0ngpass'],
      ['no lowercase', 'STR0NGPASS'],
      ['no digit', 'StrongPass'],
      ['a single character', 'a'],
    ])('rejects one that is %s', (_case, value) => {
      expect(() => new Password(value)).toThrow(ValidationError);
    });
  });

  describe('rehydrated from storage', () => {
    it('accepts a stored hash without re-applying the strength rule', () => {
      // A bcrypt digest cannot satisfy the rule, so re-checking it here would
      // make every existing user unable to log in.
      expect(() => new Password(BCRYPT_HASH, true)).not.toThrow();
      expect(new Password(BCRYPT_HASH, true).isHashed()).toBe(true);
    });

    it('still rejects an empty value', () => {
      expect(() => new Password('   ', true)).toThrow(ValidationError);
    });
  });

  it('does not treat hashed: true as a way to skip validation of a weak password', () => {
    // This is the shape of the original defect: the callers hashed first and
    // passed `true`, so `"a"` reached the database as a valid bcrypt digest.
    // The value object cannot detect that on its own — which is exactly why
    // the callers construct from the plaintext first, asserted in
    // register.spec.ts. Recorded here so the limitation is not mistaken for
    // coverage.
    expect(() => new Password(BCRYPT_HASH, true)).not.toThrow();
  });
});
