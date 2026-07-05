import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedAdaptersModule } from './shared/adapters/shared-adapters.module';
import { TypeOrmModule } from './shared/adapters/persistence/typeorm/typeorm.module';
import { AuthModule } from './modules/auth/auth.module';
import { GlobalExceptionFilter } from './shared/application/filters/global-exception.filter';
import { LoggingInterceptor } from './shared/adapters/logger/logging.interceptor';

@Module({
  imports: [
    SharedAdaptersModule,
    TypeOrmModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
