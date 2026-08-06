import { CreateProductUseCase } from './create-product.use-case';
import { GetProductUseCase } from './get-product.use-case';
import { PublishProductUseCase } from './publish-product.use-case';
import { ArchiveProductUseCase } from './archive-product.use-case';
import { AddAttributeUseCase } from './add-attribute.use-case';
import { AddMediaUseCase } from './add-media.use-case';
import { SearchProductsUseCase } from './search-products.use-case';
import { Product } from '../../domain/entities/product.entity';
import { NotFoundError } from '../../../../shared/domain/errors/domain-error';

const repo = () => ({
  save: jest.fn(),
  findById: jest.fn(),
  search: jest.fn(),
  archiveByCatalogId: jest.fn(),
});

const product = () => new Product('p1', 'c1', 'Dog Food', 'admin');

describe('CreateProductUseCase', () => {
  it('persists a draft product with a generated id', async () => {
    const r = repo();
    const result = await new CreateProductUseCase(r as any).execute(
      'c1',
      'Dog Food',
      'admin',
      'tasty',
    );

    expect(r.save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('draft');
    expect(result.catalogId).toBe('c1');
    expect(result.createdBy).toBe('admin');
    expect(result.id).toEqual(expect.any(String));
    expect(result.id.length).toBeGreaterThan(0);
  });

  it('gives each product a distinct id', async () => {
    const r = repo();
    const uc = new CreateProductUseCase(r as any);
    const a = await uc.execute('c1', 'A', 'admin');
    const b = await uc.execute('c1', 'B', 'admin');

    expect(a.id).not.toBe(b.id);
  });
});

describe('GetProductUseCase', () => {
  it('returns the product', async () => {
    const r = repo();
    r.findById.mockResolvedValue(product());
    const result = await new GetProductUseCase(r as any).execute('p1');

    expect(result.id).toBe('p1');
    expect(result.name).toBe('Dog Food');
  });

  it('throws NotFoundError for an unknown id', async () => {
    const r = repo();
    r.findById.mockResolvedValue(null);
    await expect(
      new GetProductUseCase(r as any).execute('nope'),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('PublishProductUseCase', () => {
  it('moves a draft to published and persists', async () => {
    const r = repo();
    const p = product();
    r.findById.mockResolvedValue(p);

    const result = await new PublishProductUseCase(r as any).execute('p1');

    expect(p.status).toBe('published');
    expect(result.status).toBe('published');
    expect(r.save).toHaveBeenCalledWith(p);
  });

  it('throws NotFoundError for an unknown id', async () => {
    const r = repo();
    r.findById.mockResolvedValue(null);
    await expect(
      new PublishProductUseCase(r as any).execute('nope'),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('ArchiveProductUseCase', () => {
  it('archives and persists', async () => {
    const r = repo();
    const p = product();
    r.findById.mockResolvedValue(p);

    await new ArchiveProductUseCase(r as any).execute('p1');

    expect(p.status).toBe('archived');
    expect(r.save).toHaveBeenCalledWith(p);
  });
});

describe('AddAttributeUseCase / AddMediaUseCase', () => {
  it('generates an attribute id rather than leaving it undefined', async () => {
    const r = repo();
    const p = product();
    r.findById.mockResolvedValue(p);

    const result = await new AddAttributeUseCase(r as any).execute(
      'p1',
      'colour',
      'brown',
    );

    expect(result.attributes).toHaveLength(1);
    expect(result.attributes[0].id).toEqual(expect.any(String));
    expect(result.attributes[0].id.length).toBeGreaterThan(0);
    expect(r.save).toHaveBeenCalledWith(p);
  });

  it('generates a media id rather than leaving it undefined', async () => {
    const r = repo();
    const p = product();
    r.findById.mockResolvedValue(p);

    const result = await new AddMediaUseCase(r as any).execute(
      'p1',
      'http://img/1.png',
      'image',
      true,
    );

    expect(result.media).toHaveLength(1);
    expect(result.media[0].id).toEqual(expect.any(String));
    expect(result.media[0].isPrimary).toBe(true);
  });

  it('throws NotFoundError when the product is missing', async () => {
    const r = repo();
    r.findById.mockResolvedValue(null);
    await expect(
      new AddAttributeUseCase(r as any).execute('nope', 'colour', 'brown'),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('SearchProductsUseCase', () => {
  it('maps repository results and preserves the total', async () => {
    const r = repo();
    r.search.mockResolvedValue({
      items: [product()],
      total: 42,
      page: 1,
      limit: 10,
    });

    const result = await new SearchProductsUseCase(r as any).execute({
      page: 1,
      limit: 10,
    } as any);

    expect(result.total).toBe(42);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('p1');
  });
});
