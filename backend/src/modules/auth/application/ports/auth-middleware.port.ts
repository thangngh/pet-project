export const AUTH_MIDDLEWARE_PORT = 'AUTH_MIDDLEWARE_PORT';

export interface RequestIdentity {
  userId: string;
  roles: string[];
  authMethod: 'jwt' | 'api_key';
  /** optional ABAC attributes, e.g. tenantId, region, timeOfDay */
  attributes?: Record<string, any>;
}

export interface IAuthMiddlewarePort {
  validateToken(token: string): Promise<RequestIdentity>;
  validateApiKey(apiKey: string): Promise<RequestIdentity>;
}
