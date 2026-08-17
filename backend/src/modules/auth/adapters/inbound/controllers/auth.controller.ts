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
