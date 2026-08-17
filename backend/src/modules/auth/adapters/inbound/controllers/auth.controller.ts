import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  AUTH_SERVICE,
  IAuthService,
} from '../../../application/ports/auth-service.port';
import { RegisterDto } from '../../../application/dto/register.dto';
import { LoginDto } from '../../../application/dto/login.dto';
import { AuthResponseDto } from '../../../application/dto/auth-response.dto';
import { UserProfileDto } from '../../../application/dto/user-profile.dto';
import { JwtAuthGuard } from '../../outbound/auth/jwt-auth.guard';
import { Public } from '../../outbound/auth/public.decorator';
import { Roles } from '../../outbound/auth/roles.decorator';
import { RolesGuard } from '../../outbound/auth/roles.guard';
import { SetRoleDto } from '../../../application/dto/set-role.dto';
import { RefreshTokenDto } from '../../../application/dto/refresh-token.dto';
import { ChangePasswordDto } from '../../../application/dto/change-password.dto';
import { ROLE_ADMIN } from '../../../domain/constants/role.constants';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    // Public because the access token is expected to be expired by the time a
    // client needs this. The refresh token is the credential.
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(dto.refreshToken);
  }

  /**
   * Moved here from UserController (D16). The path is unchanged, so no client
   * is affected — but the operation is Auth's, and reaching it from User took
   * a port, an adapter and a use case whose only job was crossing the
   * boundary. Under per-context pools that indirection also carried a
   * User -> Auth module dependency, which is now gone.
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(
      req.user.id,
      dto.oldPassword,
      dto.newPassword,
    );
    return { message: 'Password changed' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req): Promise<UserProfileDto> {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * Promote or demote a user. Admin-only, and the first admin cannot come from
   * here — it comes from `pnpm seed:admin`, because this endpoint needs an
   * admin to call it.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE_ADMIN)
  @Post('users/:id/role')
  @HttpCode(HttpStatus.OK)
  async setUserRole(
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
  ): Promise<UserProfileDto> {
    return this.authService.setUserRole(id, dto.role);
  }
}
