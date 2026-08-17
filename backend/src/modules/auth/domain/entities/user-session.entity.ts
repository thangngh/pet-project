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
}

/*
 * `rotate(newHash)` lived here and was never called. Deleted in spec-004 §5.
 *
 * Refresh revokes the old session and creates a new one with a new id, rather
 * than overwriting a hash in place. That is what makes reuse detectable: a
 * revoked session presented again is evidence the token leaked, and every
 * session for that user is revoked in response. Rotating in place erases the
 * old row, so a replayed token would look merely stale instead.
 *
 * A method that mutates the one field the reuse check depends on is worse than
 * unused — it is a plausible-looking shortcut back to the weaker design.
 */
