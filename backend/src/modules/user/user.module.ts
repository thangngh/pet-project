import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmUserProfile } from './adapters/outbound/persistence/typeorm-user-profile.entity';
import { UserProfileRepository } from './adapters/outbound/persistence/user-profile.repository';
import { USER_PROFILE_REPOSITORY } from './domain/ports/user-profile.repository.port';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { UserController } from './adapters/inbound/controllers/user.controller';
import { UserRegisteredHandler } from './application/handlers/user-registered.handler';
import { RequestContextModule } from '../../shared/adapters/request-context/request-context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmUserProfile], 'user'),
    CqrsModule,
    RequestContextModule,
  ],
  controllers: [UserController],
  providers: [
    {
      provide: USER_PROFILE_REPOSITORY,
      useClass: UserProfileRepository,
    },
    GetProfileUseCase,
    UpdateProfileUseCase,
    UserRegisteredHandler,
  ],
})
export class UserModule {}
