import { Controller, Get, Patch, Body, UseGuards, Post, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/adapters/outbound/auth/jwt-auth.guard';
import { Gate } from '../../../../../shared/adapters/feature-gate/gate.decorator';
import { RequestContextService } from '../../../../../shared/adapters/request-context/request-context.service';
import { GetProfileUseCase } from '../../../application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from '../../../application/use-cases/update-profile.use-case';
import { ChangePasswordUseCase } from '../../../application/use-cases/change-password.use-case';
import { UpdateProfileDto } from '../../../application/dto/update-profile.dto';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly getProfile: GetProfileUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly requestCtx: RequestContextService,
  ) {}

  @Get('me')
  @Gate('userProfile')
  async getMyProfile() {
    const identity = this.requestCtx.getIdentity();
    if (!identity?.userId) throw new UnauthorizedException();
    return this.getProfile.execute(identity.userId);
  }

  @Patch('me/profile')
  @Gate('userProfile')
  async updateMyProfile(@Body() dto: UpdateProfileDto) {
    const identity = this.requestCtx.getIdentity();
    if (!identity?.userId) throw new UnauthorizedException();
    return this.updateProfile.execute(identity.userId, dto);
  }

  @Post('auth/change-password')
  @Gate('userProfile')
  async changeMyPassword(
    @Body('oldPassword') oldPw: string,
    @Body('newPassword') newPw: string,
  ) {
    const identity = this.requestCtx.getIdentity();
    if (!identity?.userId) throw new UnauthorizedException();
    await this.changePassword.execute(identity.userId, oldPw, newPw);
    return { message: 'Password changed' };
  }
}
