import { GetCatalogUseCase } from './get-catalog.use-case';
import { GetCatalogTreeUseCase } from './get-catalog-tree.use-case';
import { UpdateCatalogUseCase } from './update-catalog.use-case';
import { ArchiveCatalogUseCase } from './archive-catalog.use-case';
import { Catalog } from '../../domain/entities/catalog.entity';
import { NotFoundError } from '../../../../shared/domain/errors/domain-error';
import { CatalogDeletedEvent } from '../../../../shared/adapters/event-bus/integration-events/catalog-deleted.event';

const repo = () => ({
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findChildren: jest.fn(),
  findDescendants: jest.fn().mockResolvedValue([]),
});

const bus = () => ({
  transaction: jest.fn(async (work: any) => work({ __tx: true })),
  write: jest.fn(),
});

describe('GetCatalogUseCase', () => {
  // Regression: this route previously ignored its id and returned the whole tree.
  it('returns only the catalog matching the id', async () => {
    const r = repo();
    r.findById.mockResolvedValue(new Catalog('c1', 'Dogs', 'root'));
    const result = await new GetCatalogUseCase(r as any).execute('c1');

    expect(r.findById).toHaveBeenCalledWith('c1');
    expect(result.id).toBe('c1');
    expect(result.name).toBe('Dogs');
    expect(result.parentId).toBe('root');
    expect(Array.isArray((result as any).children)).toBe(false);
  });

  it('throws NotFoundError for an unknown id', async () => {
    const r = repo();
    r.findById.mockResolvedValue(null);
    await expect(
      new GetCatalogUseCase(r as any).execute('nope'),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('GetCatalogTreeUseCase', () => {
  it('nests children under their parent and returns only roots', async () => {
    const r = repo();
    r.findAll.mockResolvedValue([
      new Catalog('root1', 'Pets'),
      new Catalog('c1', 'Dogs', 'root1'),
      new Catalog('c2', 'Cats', 'root1'),
      new Catalog('c3', 'Puppies', 'c1'),
      new Catalog('root2', 'Supplies'),
    ]);

    const tree = await new GetCatalogTreeUseCase(r as any).execute();

    expect(tree.map((c) => c.id).sort()).toEqual(['root1', 'root2']);
    const pets = tree.find((c) => c.id === 'root1')!;
    expect(pets.children!.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
    const dogs = pets.children!.find((c) => c.id === 'c1')!;
    expect(dogs.children!.map((c) => c.id)).toEqual(['c3']);
  });

  it('drops orphans whose parent is absent rather than throwing', async () => {
    const r = repo();
    r.findAll.mockResolvedValue([new Catalog('x', 'Orphan', 'missing-parent')]);
    await expect(
      new GetCatalogTreeUseCase(r as any).execute(),
    ).resolves.toEqual([]);
  });
});

describe('UpdateCatalogUseCase', () => {
  it('renames and persists', async () => {
    const r = repo();
    const catalog = new Catalog('c1', 'Old');
    r.findById.mockResolvedValue(catalog);

    const result = await new UpdateCatalogUseCase(r as any).execute(
      'c1',
      'New',
    );

    expect(result.name).toBe('New');
    expect(r.save).toHaveBeenCalledWith(catalog);
  });

  it('throws NotFoundError for an unknown id', async () => {
    const r = repo();
    r.findById.mockResolvedValue(null);
    await expect(
      new UpdateCatalogUseCase(r as any).execute('nope', 'New'),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('ArchiveCatalogUseCase', () => {
  it('sets status to archived and persists', async () => {
    const r = repo();
    const catalog = new Catalog('c1', 'Dogs');
    r.findById.mockResolvedValue(catalog);

    await new ArchiveCatalogUseCase(r as any, bus() as any).execute('c1');

    expect(catalog.status).toBe('archived');
    expect(r.save).toHaveBeenCalledWith(catalog, expect.anything());
  });

  // Regression: archiving used to persist without emitting anything, so the
  // products under the catalog were never archived.
  it('publishes CatalogDeleted carrying the catalog id', async () => {
    const r = repo();
    const b = bus();
    const catalog = new Catalog('c1', 'Dogs');
    r.findById.mockResolvedValue(catalog);

    await new ArchiveCatalogUseCase(r as any, b as any).execute('c1');

    expect(b.write).toHaveBeenCalledTimes(1);
    const published = b.write.mock.calls[0][0];
    expect(published).toHaveLength(1);
    expect(published[0]).toBeInstanceOf(CatalogDeletedEvent);
    expect(published[0].catalogId).toBe('c1');
  });

  describe('archiving a subtree', () => {
    // Catalogs are a tree and the tree endpoint nests to arbitrary depth, so
    // stopping at one level left grandchildren active with every product
    // beneath them still published.
    const tree = () => {
      const root = new Catalog('c1', 'Pets');
      const child = new Catalog('c2', 'Dogs', 'c1');
      const grandchild = new Catalog('c3', 'Puppies', 'c2');
      return { root, child, grandchild };
    };

    it('archives every descendant, at any depth', async () => {
      const { root, child, grandchild } = tree();
      const r = repo();
      r.findById.mockResolvedValue(root);
      r.findDescendants.mockResolvedValue([child, grandchild]);

      await new ArchiveCatalogUseCase(r as any, bus() as any).execute('c1');

      expect(root.status).toBe('archived');
      expect(child.status).toBe('archived');
      expect(grandchild.status).toBe('archived');
      expect(r.save).toHaveBeenCalledTimes(3);
    });

    it('emits one event per catalog, so consumers stay ignorant of tree shape', async () => {
      const { root, child, grandchild } = tree();
      const r = repo();
      const b = bus();
      r.findById.mockResolvedValue(root);
      r.findDescendants.mockResolvedValue([child, grandchild]);

      await new ArchiveCatalogUseCase(r as any, b as any).execute('c1');

      const ids = b.write.mock.calls
        .flatMap((call) => call[0])
        .map((event: CatalogDeletedEvent) => event.catalogId);

      // Product handles one event, one catalog id — the same contract as
      // before. An id list in the event would couple every consumer to the
      // producer's tree.
      expect(ids.sort()).toEqual(['c1', 'c2', 'c3']);
    });

    it('does not re-emit for a node already archived', async () => {
      const { root, child } = tree();
      child.archive();
      child.clearEvents();

      const r = repo();
      const b = bus();
      r.findById.mockResolvedValue(root);
      r.findDescendants.mockResolvedValue([child]);

      await new ArchiveCatalogUseCase(r as any, b as any).execute('c1');

      const ids = b.write.mock.calls
        .flatMap((call) => call[0])
        .map((event: CatalogDeletedEvent) => event.catalogId);

      // Makes a partial re-run safe, which matters once the outbox can
      // redeliver.
      expect(ids).toEqual(['c1']);
    });
  });

  it('publishes after the catalog is saved', async () => {
    const order: string[] = [];
    const r = repo();
    const b = bus();
    const catalog = new Catalog('c1', 'Dogs');
    r.findById.mockResolvedValue(catalog);
    r.save.mockImplementation(async () => {
      order.push('save');
    });
    b.write.mockImplementation(async () => {
      order.push('publish');
    });

    await new ArchiveCatalogUseCase(r as any, b as any).execute('c1');

    expect(order).toEqual(['save', 'publish']);
  });

  it('does not re-publish when the catalog is already archived', async () => {
    const r = repo();
    const b = bus();
    const catalog = new Catalog('c1', 'Dogs', undefined, 'archived');
    r.findById.mockResolvedValue(catalog);

    await new ArchiveCatalogUseCase(r as any, b as any).execute('c1');

    // Still enqueues, with nothing in it: the aggregate collected no event
    // because it was already archived. The real Outbox writes no row for an
    // empty list.
    expect(b.write).toHaveBeenCalledWith([], expect.anything());
  });

  it('throws NotFoundError for an unknown id', async () => {
    const r = repo();
    r.findById.mockResolvedValue(null);
    await expect(
      new ArchiveCatalogUseCase(r as any, bus() as any).execute('nope'),
    ).rejects.toThrow(NotFoundError);
  });
});
