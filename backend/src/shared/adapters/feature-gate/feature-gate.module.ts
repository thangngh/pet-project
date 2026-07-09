import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FeatureGateService } from './feature-gate.service';
import { GateGuard } from './feature-gate.guard';

@Module({
  providers: [
    FeatureGateService,
    {
      provide: APP_GUARD,
      useClass: GateGuard,
    },
  ],
  exports: [FeatureGateService],
})
export class FeatureGateModule {}
