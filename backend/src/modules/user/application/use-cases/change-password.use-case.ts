import { Injectable, Inject } from '@nestjs/common';
import { AUTH_PASSWORD_PORT, IAuthPasswordPort } from '../ports/auth-password.port';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(AUTH_PASSWORD_PORT) private readonly authPassword: IAuthPasswordPort,
  ) {}

  async execute(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    await this.authPassword.changePassword(userId, oldPassword, newPassword);
  }
}
