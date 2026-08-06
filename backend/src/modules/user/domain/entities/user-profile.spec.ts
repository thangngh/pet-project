import { UserProfile } from '../entities/user-profile.entity';
import { Phone } from '../value-objects/phone.value-object';

describe('UserProfile', () => {
  it('creates with inactive status', () => {
    const p = UserProfile.create('u1', 'test@test.com');
    expect(p.status).toBe('inactive');
    expect(p.email).toBe('test@test.com');
  });

  it('updates profile fields', () => {
    const p = UserProfile.create('u1', 'test@test.com');
    p.updateProfile('John', 'Doe', new Phone('+84123456789'));
    expect(p.firstName).toBe('John');
    expect(p.lastName).toBe('Doe');
    expect(p.phone?.toString()).toBe('+84123456789');
  });

  it('activates and deactivates', () => {
    const p = UserProfile.create('u1', 'test@test.com');
    p.activate();
    expect(p.status).toBe('active');
    p.deactivate();
    expect(p.status).toBe('inactive');
  });

  it('updateProfile with partial fields', () => {
    const p = UserProfile.create('u1', 'test@test.com');
    p.updateProfile('John');
    expect(p.firstName).toBe('John');
    expect(p.lastName).toBe('');
  });
});
