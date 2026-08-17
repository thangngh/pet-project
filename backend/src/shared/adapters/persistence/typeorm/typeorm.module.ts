import { Module } from '@nestjs/common';
import { TypeOrmModule as NestTypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  DB_CONTEXTS,
  DbContext,
  ContextDbConfig,
} from '../../config/context-db.config';

/**
 * One named data source per bounded context (docs/decision.md D4).
 *
 * There is deliberately NO default connection. Every `forFeature` and every
 * `@InjectRepository` must name its context, so a repository cannot silently
 * borrow another context's pool — a missing name fails at container build,
 * which `app.bootstrap.spec.ts` catches.
 *
 * What this makes impossible, by construction rather than by review:
 * cross-context joins and cross-context transactions. That is the point of the
 * seam, and it is why the outbox (spec-003) is not optional.
 */
const contextDataSource = (context: DbContext) =>
  NestTypeOrmModule.forRootAsync({
    name: context,
    useFactory: (configService: ConfigService) => {
      const db = configService.get<ContextDbConfig>(`app.database.${context}`);

      return {
        // Also required inside the factory, not only on forRootAsync: the
        // shutdown hook resolves the data source from the *factory's* options,
        // and without a name it looks for a default connection that no longer
        // exists.
        name: context,

        type: 'postgres' as const,
        host: db.host,
        port: db.port,
        username: db.username,
        password: db.password,
        database: db.database,

        // The context owns this schema and nothing outside it.
        schema: db.schema,
        poolSize: db.poolSize,

        // Distinguishes the four pools in pg_stat_activity.
        applicationName: db.applicationName,

        autoLoadEntities: true,

        // gen_random_uuid() instead of uuid_generate_v4(): built into
        // PostgreSQL 13+, so no extension to install. Set here as well as in
        // the CLI data source, or a generated migration would disagree with a
        // hand-written one.
        uuidExtension: 'pgcrypto' as const,

        // Schemas come from migrations, never from the application. Running
        // migrations is an explicit step, never a side effect of boot.
        synchronize: false,
        migrationsRun: false,

        logging: configService.get<boolean>('app.database.logging', false),
      };
    },
    inject: [ConfigService],
  });

@Module({
  imports: DB_CONTEXTS.map(contextDataSource),
})
export class TypeOrmModule {}
