import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedAdaptersModule } from './shared/adapters/shared-adapters.module';
import { TypeOrmModule } from './shared/adapters/persistence/typeorm/typeorm.module';
import {
  IntegrationEventDispatcherModule,
  OutboxRunnerModule,
} from './shared/adapters/outbox/outbox.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ProductModule } from './modules/product/product.module';
import { GlobalExceptionFilter } from './shared/application/filters/global-exception.filter';
import { LoggingInterceptor } from './shared/adapters/logger/logging.interceptor';

@Module({
  imports: [
    SharedAdaptersModule,
    TypeOrmModule,
    IntegrationEventDispatcherModule,
    AuthModule,
    UserModule,
    CatalogModule,
    ProductModule,
    OutboxRunnerModule.register(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      // Nothing validated request bodies before this: the DTOs carried
      // class-validator decorators and no pipe ever read them, so a
      // one-character password reached the domain unchallenged.
      //
      // Registered as APP_PIPE rather than app.useGlobalPipes() in main.ts so
      // that app.bootstrap.spec.ts covers it — a pipe added in main.ts is
      // invisible to every test.
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        // Query and path parameters arrive as strings; without this,
        // `?page=2` fails @IsInt and DTO defaults never apply.
        transform: true,

        // Undeclared properties are stripped, then rejected. Stricter than a
        // client may expect — see D2; drop forbidNonWhitelisted alone if it
        // bites before a client exists to complain.
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    },
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
