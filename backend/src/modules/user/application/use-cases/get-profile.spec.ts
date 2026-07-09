import { GetProfileUseCase } from './get-profile.use-case';

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

  it('throws when not found', async () => {
    const mockRepo = { findByUserId: jest.fn().mockResolvedValue(null) };
    const uc = new GetProfileUseCase(mockRepo as any);
    await expect(uc.execute('u1')).rejects.toThrow('Profile not found');
  });
});
