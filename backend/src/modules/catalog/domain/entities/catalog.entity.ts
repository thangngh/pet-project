import { DomainEvent } from '../../../../shared/adapters/event-bus/domain-event';
import { CatalogDeletedEvent } from '../../../../shared/adapters/event-bus/integration-events/catalog-deleted.event';

export class Catalog {
  private _events: DomainEvent[] = [];

  constructor(
    public readonly id: string,
    public name: string,
    public parentId?: string,
    public status: 'active' | 'archived' = 'active',
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public version: number = 1,
  ) {}

  updateName(name: string): void {
    this.name = name;
    this.updatedAt = new Date();
  }

  archive(): void {
    if (this.status === 'archived') return;
    this.status = 'archived';
    this.updatedAt = new Date();
    this._events.push(new CatalogDeletedEvent(this.id));
  }

  get events(): DomainEvent[] {
    return [...this._events];
  }

  clearEvents(): void {
    this._events = [];
  }
}
