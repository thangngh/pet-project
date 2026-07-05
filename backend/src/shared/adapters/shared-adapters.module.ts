import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './logger/logger.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { HttpModule } from './http/http.module';
import { EventBusModule } from './event-bus/event-bus.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    RateLimitModule,
    HttpModule,
    EventBusModule,
  ],
  exports: [
    ConfigModule,
    LoggerModule,
    RateLimitModule,
    HttpModule,
    EventBusModule,
  ],
})
export class SharedAdaptersModule {}
