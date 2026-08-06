import { GetCatalogUseCase } from './get-catalog.use-case';
import { GetCatalogTreeUseCase } from './get-catalog-tree.use-case';
import { UpdateCatalogUseCase } from './update-catalog.use-case';
import { ArchiveCatalogUseCase } from './archive-catalog.use-case';
import { Catalog } from '../../domain/entities/catalog.entity';
import { NotFoundError } from '../../../../shared/domain/errors/domain-error';

const repo = () => ({
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findChildren: jest.fn(),
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

    await new ArchiveCatalogUseCase(r as any).execute('c1');

    expect(catalog.status).toBe('archived');
    expect(r.save).toHaveBeenCalledWith(catalog);
  });

  it('throws NotFoundError for an unknown id', async () => {
    const r = repo();
    r.findById.mockResolvedValue(null);
    await expect(
      new ArchiveCatalogUseCase(r as any).execute('nope'),
    ).rejects.toThrow(NotFoundError);
  });
});
