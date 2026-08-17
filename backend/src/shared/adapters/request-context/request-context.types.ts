/**
 * Who the current request is acting as.
 *
 * This is the only definition. An identical copy lived on the dead
 * `AUTH_MIDDLEWARE_PORT` until spec-004 §1 — identical by luck, since nothing
 * kept the two in step. It lives beside the context that holds it so that a
 * change to the shape and a change to the store are the same edit.
 */
export interface RequestIdentity {
  userId: string;
  roles: string[];
  /**
   * `api_key` is reserved. Only `jwt` is issued today — the API-key path is a
   * plan (see CLAUDE.md, Auth), not a mechanism.
   */
  authMethod: 'jwt' | 'api_key';
  /** Optional ABAC attributes, e.g. tenantId, region, timeOfDay. */
  attributes?: Record<string, any>;
}
