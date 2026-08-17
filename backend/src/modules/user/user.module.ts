import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmUserProfile } from './adapters/outbound/persistence/typeorm-user-profile.entity';
import { TypeOrmUserSession } from './adapters/outbound/persistence/typeorm-user-session.entity';
import { UserProfileRepository } from './adapters/outbound/persistence/user-profile.repository';
import { UserSessionRepository } from './adapters/outbound/persistence/user-session.repository';
import { USER_PROFILE_REPOSITORY } from './domain/ports/user-profile.repository.port';
import { USER_SESSION_REPOSITORY } from './domain/ports/user-session.repository.port';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { UserController } from './adapters/inbound/controllers/user.controller';
import { UserRegisteredHandler } from './application/handlers/user-registered.handler';
import { AuthModule } from '../auth/auth.module';
import { AUTH_PASSWORD_PORT } from './application/ports/auth-password.port';
import { AuthPasswordAdapter } from './adapters/outbound/auth/auth-password.adapter';
import { RequestContextModule } from '../../shared/adapters/request-context/request-context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmUserProfile, TypeOrmUserSession]),
    CqrsModule,
    AuthModule,
    RequestContextModule,
  ],
  controllers: [UserController],
  providers: [
    {
      provide: USER_PROFILE_REPOSITORY,
      useClass: UserProfileRepository,
    },
    {
      provide: USER_SESSION_REPOSITORY,
      useClass: UserSessionRepository,
    },
    {
      provide: AUTH_PASSWORD_PORT,
      useClass: AuthPasswordAdapter,
    },
    GetProfileUseCase,
    UpdateProfileUseCase,
    ChangePasswordUseCase,
    UserRegisteredHandler,
  ],
})
export class UserModule {}
