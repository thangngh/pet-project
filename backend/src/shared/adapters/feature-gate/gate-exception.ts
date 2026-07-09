export class GateException extends Error {
  public readonly feature: string;

  constructor(feature: string) {
    super(`Feature '${feature}' is currently disabled`);
    this.name = 'GateException';
    this.feature = feature;
  }
}
