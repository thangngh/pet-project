import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmUserEntity } from './adapters/outbound/persistence/typeorm-user.entity';
import { TypeOrmUserSession } from './adapters/outbound/persistence/typeorm-user-session.entity';
import { UserRepository } from './adapters/outbound/persistence/user.repository';
import { UserSessionRepository } from './adapters/outbound/persistence/user-session.repository';
import { USER_REPOSITORY } from './domain/ports/user-repository.port';
import { USER_SESSION_REPOSITORY } from './domain/ports/user-session.repository.port';
import { RequestContextModule } from '../../shared/adapters/request-context/request-context.module';
import { AUTH_SERVICE } from './application/ports/auth-service.port';
import { JwtStrategy } from './adapters/outbound/auth/jwt.strategy';
import { AuthService } from './application/services/auth.service';
import { OutboxModule } from '../../shared/adapters/outbox/outbox.module';
import { AuthController } from './adapters/inbound/controllers/auth.controller';
import { AttributesGuard } from './adapters/outbound/auth/attributes.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmUserEntity, TypeOrmUserSession], 'auth'),
    OutboxModule.forContext('auth'),
    RequestContextModule,
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
    JwtStrategy,
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      // Moved here from UserModule (D15): under D4 there is no cross-context
      // pool, so the sessions table has to live in the schema owned by the
      // context that writes it. Nothing reads it yet — spec-002 §6 does.
      provide: USER_SESSION_REPOSITORY,
      useClass: UserSessionRepository,
    },
    {
      provide: APP_GUARD,
      useClass: AttributesGuard,
    },
  ],
  exports: [USER_REPOSITORY, AUTH_SERVICE],
})
export class AuthModule {}
