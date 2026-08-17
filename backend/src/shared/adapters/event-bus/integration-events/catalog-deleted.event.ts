import { DomainEvent } from '../domain-event';

/**
 * Published by the Catalog context when a catalog is archived.
 * Consumed by the Product context to archive the products under it.
 *
 * The name predates the operation: nothing is deleted, the catalog is archived.
 * It is kept so the existing gate and checkpoint records stay readable.
 */
export class CatalogDeletedEvent extends DomainEvent {
  constructor(public readonly catalogId: string) {
    super();
  }
}
