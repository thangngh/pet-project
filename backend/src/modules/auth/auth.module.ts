import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { TypeOrmUserEntity } from './adapters/outbound/persistence/typeorm-user.entity';
import { UserRepository } from './adapters/outbound/persistence/user.repository';
import { USER_REPOSITORY } from './domain/ports/user-repository.port';
import { AUTH_SERVICE } from './application/ports/auth-service.port';
import { JwtStrategy } from './adapters/outbound/auth/jwt.strategy';
import { AuthService } from './application/services/auth.service';
import { EventBusService } from './application/services/event-bus.service';
import { AuthController } from './adapters/inbound/controllers/auth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmUserEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.jwt.secret'),
        signOptions: { expiresIn: 900 },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_SERVICE,
      useClass: AuthService,
    },
    EventBusService,
    JwtStrategy,
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
  ],
  exports: [USER_REPOSITORY, AUTH_SERVICE],
})
export class AuthModule {}
