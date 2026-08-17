/**
 * The one spelling of a role in this system.
 *
 * These constants used to read 'ADMIN' / 'USER' while `UserRole` was
 * 'admin' | 'user' and all eleven controllers wrote `@Roles('admin')`. Two
 * vocabularies, no overlap: had RBAC been switched on, every admin endpoint
 * would have denied every caller, silently and correctly-looking.
 *
 * Nothing caught it because roles.guard.spec.ts compared ROLE_ADMIN against
 * ROLE_ADMIN — self-consistent, and disconnected from the values the rest of
 * the system uses.
 *
 * They live in the domain, not the application layer, so the domain can name
 * a role without importing upward. Pure TypeScript, no package imports.
 *
 * ROLE_SERVICE is gone: no `UserRole` ever admitted it and no service account
 * exists. It returns when a caller for it does.
 */
export const ROLE_ADMIN = 'admin';
export const ROLE_USER = 'user';

/**
 * Derived from the constants rather than written alongside them, so the two
 * cannot drift apart again — a divergence now fails to compile.
 */
export type UserRole = typeof ROLE_ADMIN | typeof ROLE_USER;

export const ALL_ROLES: readonly UserRole[] = [ROLE_ADMIN, ROLE_USER];
