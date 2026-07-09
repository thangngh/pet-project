import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  apiPrefix: process.env.API_PREFIX || 'api',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),

  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'ddd_project',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',

    auth: {
      host: process.env.DB_AUTH_HOST || 'localhost',
      port: parseInt(process.env.DB_AUTH_PORT, 10) || 5432,
      username: process.env.DB_AUTH_USERNAME || 'postgres',
      password: process.env.DB_AUTH_PASSWORD || 'postgres',
      database: process.env.DB_AUTH_DATABASE || 'ddd_auth',
    },
    user: {
      host: process.env.DB_USER_HOST || 'localhost',
      port: parseInt(process.env.DB_USER_PORT, 10) || 5433,
      username: process.env.DB_USER_USERNAME || 'postgres',
      password: process.env.DB_USER_PASSWORD || 'postgres',
      database: process.env.DB_USER_DATABASE || 'ddd_user',
    },
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
