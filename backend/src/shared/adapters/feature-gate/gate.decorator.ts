import { SetMetadata } from '@nestjs/common';
import { GATE_KEY, FeatureFlag } from './feature-gate.types';

export const Gate = (feature: FeatureFlag) => SetMetadata(GATE_KEY, feature);
