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

  it('resolves the whole provider graph', async () => {
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue({
        isInitialized: true,
        destroy: jest.fn(),
      } as unknown as DataSource);

    for (const entity of entities) {
      builder.overrideProvider(getRepositoryToken(entity)).useValue({});
    }

    const moduleRef = await builder.compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
