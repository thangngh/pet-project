import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import { TypeOrmUserEntity } from './modules/auth/adapters/outbound/persistence/typeorm-user.entity';
import { TypeOrmUserProfile } from './modules/user/adapters/outbound/persistence/typeorm-user-profile.entity';
import { TypeOrmUserSession } from './modules/user/adapters/outbound/persistence/typeorm-user-session.entity';
import { TypeOrmCatalog } from './modules/catalog/adapters/outbound/persistence/typeorm-catalog.entity';
import { TypeOrmProduct } from './modules/product/adapters/outbound/persistence/typeorm-product.entity';

/**
 * Resolves every provider in the real AppModule graph with the database
 * stubbed out. TypeScript does not check dependency injection and unit tests
 * do not build the container, so an unbound token is invisible to both — this
 * is the only check that fails when the wiring is wrong.
 */
describe('AppModule wiring', () => {
  const entities = [
    TypeOrmUserEntity,
    TypeOrmUserProfile,
    TypeOrmUserSession,
    TypeOrmCatalog,
    TypeOrmProduct,
  ];

  const build = () => {
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue({
        isInitialized: true,
        destroy: jest.fn(),
      } as unknown as DataSource);

    for (const entity of entities) {
      builder.overrideProvider(getRepositoryToken(entity)).useValue({});
    }

    return builder.compile();
  };

  it('resolves the whole provider graph', async () => {
    const moduleRef = await build();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  // Routes used to come out as /api/api/v1/... because three controllers
  // repeated the global prefix. Nothing failed — the paths were simply wrong.
  it('mounts every route under a single api/v1 prefix', async () => {
    const moduleRef = await build();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();

    const server = app.getHttpAdapter().getInstance();
    const paths: string[] = (server._router?.stack ?? [])
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route.path);

    expect(paths).toContain('/health');
    expect(paths).toContain('/api/v1/auth/login');
    expect(paths).toContain('/api/v1/me');
    expect(paths).toContain('/api/v1/catalogs/tree');
    expect(paths).toContain('/api/v1/products');

    const versioned = paths.filter((p) => p !== '/health');
    expect(versioned.length).toBeGreaterThan(0);
    for (const path of versioned) {
      expect(path.startsWith('/api/v1/')).toBe(true);
      expect(path).not.toContain('/api/api');
    }

    await app.close();
  });
});
