import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { AUTH_SERVICE, IAuthService } from '../../../application/ports/auth-service.port';
import { RegisterDto } from '../../../application/dto/register.dto';
import { LoginDto } from '../../../application/dto/login.dto';
import { AuthResponseDto } from '../../../application/dto/auth-response.dto';
import { UserProfileDto } from '../../../application/dto/user-profile.dto';
import { JwtAuthGuard } from '../../outbound/auth/jwt-auth.guard';
import { Public } from '../../outbound/auth/public.decorator';

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
}
