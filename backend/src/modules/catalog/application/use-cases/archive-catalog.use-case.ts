import { Injectable, Inject } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain-error';
import { Outbox } from '../../../../shared/adapters/outbox/outbox';
import { OUTBOX } from '../../../../shared/adapters/outbox/outbox.module';
import {
  CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../domain/ports/catalog.repository.port';

@Injectable()
export class ArchiveCatalogUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: ICatalogRepository,
    @Inject(OUTBOX('catalog')) private readonly outbox: Outbox,
  ) {}

  /**
   * Archives a catalog and everything beneath it.
   *
   * Archiving used to stop at the catalog itself, and the Product context
   * matched products by their own catalogId — so archiving a parent left its
   * children active with every product under them still published. The tree
   * endpoint nests to arbitrary depth, which makes one level a defect rather
   * than a limit.
   *
   * One event per archived catalog, so consumers stay ignorant of tree shape:
   * Product still handles one event, one catalog id. Carrying an id list in
   * the event would couple every consumer to the producer's tree.
   */
  async execute(id: string): Promise<void> {
    const catalog = await this.repo.findById(id);
    if (!catalog) throw new NotFoundError('Catalog', id);

    const subtree = [catalog, ...(await this.repo.findDescendants(id))];

    // One transaction for the whole subtree: every catalog and every message
    // commits together, or none does. A subtree of 50 emits 50 messages in
    // one go, which the poller's batch limit is sized for.
    await this.outbox.transaction(async (tx) => {
      for (const node of subtree) {
        // Already-archived nodes collect no event, so a partial re-run is safe.
        node.archive();
        await this.repo.save(node, tx);
        await this.outbox.write(node.events, tx);
        node.clearEvents();
      }
    });
  }
}
