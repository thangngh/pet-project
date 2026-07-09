export class UserSession {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public refreshTokenHash: string,
    public userAgent?: string,
    public ip?: string,
    public readonly createdAt: Date = new Date(),
    public expiresAt: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    public revokedAt?: Date,
  ) {}

  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  get isRevoked(): boolean {
    return !!this.revokedAt;
  }

  revoke(): void {
    this.revokedAt = new Date();
  }

  rotate(newHash: string): void {
    this.refreshTokenHash = newHash;
  }
}
