import { registerAs } from '@nestjs/config';
import { allContextDbConfigs } from './context-db.config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),

  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  database: {
    // Shared knobs. Connection settings are per context — see below.
    logging: process.env.DB_LOGGING === 'true',

    // One block per bounded context, each with its own pool and schema (D4).
    // Never a `synchronize` option: schemas come from migrations only.
    ...allContextDbConfigs(),
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  gate: {
    apiLocked: process.env.API_LOCKED === 'true',
  },

  features: {
    rbac: process.env.FEATURE_RBAC === 'true',
    abac: process.env.FEATURE_ABAC === 'true',
    userProfile: process.env.FEATURE_USER_PROFILE === 'true',
    productCatalog: process.env.FEATURE_PRODUCT_CATALOG === 'true',
    shipping: process.env.FEATURE_SHIPPING === 'true',
  },
}));
