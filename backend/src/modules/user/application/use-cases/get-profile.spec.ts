import { GetProfileUseCase } from './get-profile.use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain-error';

describe('GetProfileUseCase', () => {
  it('returns profile when found', async () => {
    const mockProfile = {
      userId: 'u1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      phone: undefined,
      avatar: undefined,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockRepo = { findByUserId: jest.fn().mockResolvedValue(mockProfile) };
    const uc = new GetProfileUseCase(mockRepo as any);
    const result = await uc.execute('u1');
    expect(result.firstName).toBe('John');
    expect(result.email).toBe('john@test.com');
  });

  it('throws NotFoundError when not found', async () => {
    const mockRepo = { findByUserId: jest.fn().mockResolvedValue(null) };
    const uc = new GetProfileUseCase(mockRepo as any);
    // NotFoundError is what GlobalExceptionFilter maps to 404; a bare Error would be a 500.
    await expect(uc.execute('u1')).rejects.toThrow(NotFoundError);
  });
});
