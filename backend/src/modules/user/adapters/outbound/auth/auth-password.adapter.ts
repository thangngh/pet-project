import { Injectable, Inject } from '@nestjs/common';
import {
  AUTH_SERVICE,
  IAuthService,
} from '../../../../auth/application/ports/auth-service.port';
import { IAuthPasswordPort } from '../../../application/ports/auth-password.port';

/**
 * Outbound adapter satisfying the User BC's IAuthPasswordPort.
 *
 * Password material lives in the Auth BC, so the User BC delegates rather than
 * reaching into it: this adapter depends on the AUTH_SERVICE port interface only,
 * never on Auth domain types.
 */
@Injectable()
export class AuthPasswordAdapter implements IAuthPasswordPort {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: IAuthService,
  ) {}

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.authService.changePassword(userId, oldPassword, newPassword);
  }
}
