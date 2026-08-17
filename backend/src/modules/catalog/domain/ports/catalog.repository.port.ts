import { Catalog } from '../entities/catalog.entity';

/**
 * The transaction an aggregate write must join.
 *
 * Typed as `unknown` on purpose: this is a domain port, and the domain layer
 * imports nothing. The adapter narrows it to TypeORM's EntityManager.
 */
export type TransactionScope = unknown;

export const CATALOG_REPOSITORY = 'CATALOG_REPOSITORY';

export interface ICatalogRepository {
  /**
   * `tx` is required for any write whose events go to the outbox: the
   * aggregate and its messages must commit together or the outbox is a slower
   * version of publishing straight to the bus.
   */
  save(catalog: Catalog, tx?: TransactionScope): Promise<void>;
  findById(id: string): Promise<Catalog | null>;
  findAll(): Promise<Catalog[]>;
  findChildren(parentId: string): Promise<Catalog[]>;

  /**
   * Every catalog beneath this one, at any depth — not just its children.
   *
   * The Catalog context owns the tree, so it is the only place that can
   * resolve it. Product must not learn about tree shape to archive correctly.
   */
  findDescendants(id: string): Promise<Catalog[]>;
}
