import { ChangePasswordUseCase } from './change-password.use-case';
import { AuthPasswordAdapter } from '../../adapters/outbound/auth/auth-password.adapter';

describe('ChangePasswordUseCase', () => {
  it('delegates to the auth password port', async () => {
    const port = { changePassword: jest.fn().mockResolvedValue(undefined) };
    await new ChangePasswordUseCase(port as any).execute(
      'u1',
      'Old1234',
      'New1234',
    );

    expect(port.changePassword).toHaveBeenCalledWith(
      'u1',
      'Old1234',
      'New1234',
    );
  });

  it('propagates failures from the port rather than swallowing them', async () => {
    const port = {
      changePassword: jest.fn().mockRejectedValue(new Error('wrong password')),
    };
    await expect(
      new ChangePasswordUseCase(port as any).execute('u1', 'bad', 'New1234'),
    ).rejects.toThrow('wrong password');
  });
});

describe('AuthPasswordAdapter', () => {
  // The User BC owns no password material; it must delegate to the Auth BC.
  it('forwards to AuthService without touching password material', async () => {
    const authService = {
      changePassword: jest.fn().mockResolvedValue(undefined),
    };
    await new AuthPasswordAdapter(authService as any).changePassword(
      'u1',
      'Old1234',
      'New1234',
    );

    expect(authService.changePassword).toHaveBeenCalledWith(
      'u1',
      'Old1234',
      'New1234',
    );
  });
});
