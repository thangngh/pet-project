export interface RequestIdentity {
  userId: string;
  roles: string[];
  authMethod: 'jwt' | 'api_key';
  attributes?: Record<string, any>;
}
