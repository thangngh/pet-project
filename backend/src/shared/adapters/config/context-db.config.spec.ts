import {
  DB_CONTEXTS,
  contextDb,
  allContextDbConfigs,
} from './context-db.config';

/**
 * The fallback chain is the whole of D4: it is what makes moving a context to
 * its own database a change of environment variables rather than of code. If
 * these assertions stop holding, that claim stops being true.
 */
describe('per-context database config', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('DB_')) delete process.env[key];
    }
  });

  afterAll(() => {
    process.env = original;
  });

  describe('with no per-context variables set', () => {
    it('puts every context on the same server and database', () => {
      process.env.DB_HOST = 'db.internal';
      process.env.DB_DATABASE = 'ddd_project';

      const configs = allContextDbConfigs();

      for (const context of DB_CONTEXTS) {
        expect(configs[context].host).toBe('db.internal');
        expect(configs[context].database).toBe('ddd_project');
      }
    });

    it('still gives every context its own schema', () => {
      const configs = allContextDbConfigs();
      const schemas = DB_CONTEXTS.map((c) => configs[c].schema);

      expect(schemas).toEqual(['auth', 'user', 'catalog', 'product']);
      expect(new Set(schemas).size).toBe(DB_CONTEXTS.length);
    });

    it('still gives every context its own pool, identifiable in pg_stat_activity', () => {
      const names = DB_CONTEXTS.map((c) => contextDb(c).applicationName);
      expect(new Set(names).size).toBe(DB_CONTEXTS.length);
    });
  });

  describe('with one context overridden', () => {
    it('moves only that context', () => {
      process.env.DB_HOST = 'shared.internal';
      process.env.DB_DATABASE = 'ddd_project';
      process.env.DB_CATALOG_HOST = 'catalog.internal';
      process.env.DB_CATALOG_DATABASE = 'ddd_catalog';

      const configs = allContextDbConfigs();

      expect(configs.catalog.host).toBe('catalog.internal');
      expect(configs.catalog.database).toBe('ddd_catalog');

      for (const context of ['auth', 'user', 'product'] as const) {
        expect(configs[context].host).toBe('shared.internal');
        expect(configs[context].database).toBe('ddd_project');
      }
    });

    it('falls back per field, not per context', () => {
      process.env.DB_USERNAME = 'shared_user';
      process.env.DB_CATALOG_HOST = 'catalog.internal';

      const catalog = contextDb('catalog');

      // Overriding the host must not orphan the credentials.
      expect(catalog.host).toBe('catalog.internal');
      expect(catalog.username).toBe('shared_user');
    });
  });

  it('coerces numeric variables, which arrive as strings', () => {
    process.env.DB_PORT = '5432';
    process.env.DB_PRODUCT_PORT = '5435';
    process.env.DB_PRODUCT_POOL_SIZE = '4';

    expect(contextDb('product').port).toBe(5435);
    expect(contextDb('product').poolSize).toBe(4);
    expect(contextDb('auth').port).toBe(5432);
  });
});
