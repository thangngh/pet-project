export const AUTH_PASSWORD_PORT = 'AUTH_PASSWORD_PORT';

export interface IAuthPasswordPort {
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
}
