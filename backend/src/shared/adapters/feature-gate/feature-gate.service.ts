import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeatureFlag, GateMetadata } from './feature-gate.types';

@Injectable()
export class FeatureGateService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled(feature: FeatureFlag): boolean {
    return this.configService.get<boolean>(`app.features.${feature}`) ?? false;
  }

  isApiLocked(): boolean {
    return this.configService.get<boolean>('app.gate.apiLocked') ?? false;
  }

  getMetadata(feature: FeatureFlag): GateMetadata {
    return { feature };
  }
}
