import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import appConfig from './app.config';
import { DB_CONTEXTS } from './context-db.config';

const perContextDbSchema = (): Record<string, Joi.Schema> =>
  DB_CONTEXTS.reduce((schema, context) => {
    const key = context.toUpperCase();
    return {
      ...schema,
      [`DB_${key}_HOST`]: Joi.string().optional(),
      [`DB_${key}_PORT`]: Joi.number().optional(),
      [`DB_${key}_USERNAME`]: Joi.string().optional(),
      [`DB_${key}_PASSWORD`]: Joi.string().optional(),
      [`DB_${key}_DATABASE`]: Joi.string().optional(),
      [`DB_${key}_POOL_SIZE`]: Joi.number().optional(),
    };
  }, {});

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3001),
        JWT_SECRET: Joi.string().min(16).optional(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().default('postgres'),
        DB_PASSWORD: Joi.string().default('postgres'),
        DB_DATABASE: Joi.string().default('ddd_project'),

        // Per-context overrides (D4). Unset means the context falls back to the
        // shared DB_* values above — same server, its own pool and schema.
        // Setting a context's HOST/DATABASE moves it to a database of its own.
        ...perContextDbSchema(),

        THROTTLE_TTL: Joi.number().default(60),
        THROTTLE_LIMIT: Joi.number().default(100),
        LOG_LEVEL: Joi.string()
          .valid('error', 'warn', 'info', 'debug')
          .default('info'),
      }),
      validationOptions: {
        abortEarly: true,
      },
    }),
  ],
})
export class ConfigModule {}
