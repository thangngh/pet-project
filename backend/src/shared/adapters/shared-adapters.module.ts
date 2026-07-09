import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './logger/logger.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { HttpModule } from './http/http.module';
import { EventBusModule } from './event-bus/event-bus.module';
import { FeatureGateModule } from './feature-gate/feature-gate.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    RateLimitModule,
    HttpModule,
    EventBusModule,
    FeatureGateModule,
  ],
  exports: [
    ConfigModule,
    LoggerModule,
    RateLimitModule,
    HttpModule,
    EventBusModule,
    FeatureGateModule,
  ],
})
export class SharedAdaptersModule {}
