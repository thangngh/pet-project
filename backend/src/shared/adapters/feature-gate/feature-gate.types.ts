export const GATE_KEY = 'gate';

export type FeatureFlag =
  | 'userProfile'
  | 'productCatalog'
  | 'shipping';

export interface GateMetadata {
  feature: FeatureFlag;
}
