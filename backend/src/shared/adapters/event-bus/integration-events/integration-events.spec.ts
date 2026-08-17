import { Test, TestingModule } from '@nestjs/testing';
import { EventBusModule } from '../event-bus.module';
import { EventBusService } from '../event-bus.service';
import { CatalogDeletedEvent } from './catalog-deleted.event';
import { UserCreatedEvent } from './user-created.event';
import { CatalogDeletedHandler } from '../../../../modules/product/application/handlers/catalog-deleted.handler';
import { UserRegisteredHandler } from '../../../../modules/user/application/handlers/user-registered.handler';
import { PRODUCT_REPOSITORY } from '../../../../modules/product/domain/ports/product.repository.port';
import { USER_PROFILE_REPOSITORY } from '../../../../modules/user/domain/ports/user-profile.repository.port';

/**
 * Publishes through the real EventBus rather than a mock. A handler bound to
 * the wrong class — or to no class at all — still compiles and still passes a
 * unit test that calls `handle()` directly, so only a round trip through the
 * bus shows whether the subscription exists.
 */
describe('integration events', () => {
  let moduleRef: TestingModule;
  let bus: EventBusService;
  const productRepo = { archiveByCatalogId: jest.fn() };
  const profileRepo = { save: jest.fn(), findByUserId: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      imports: [EventBusModule],
      providers: [
        CatalogDeletedHandler,
        UserRegisteredHandler,
        { provide: PRODUCT_REPOSITORY, useValue: productRepo },
        { provide: USER_PROFILE_REPOSITORY, useValue: profileRepo },
      ],
    }).compile();

    await moduleRef.init();
    bus = moduleRef.get(EventBusService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  const settle = () => new Promise((resolve) => setImmediate(resolve));

  it('delivers CatalogDeleted to the product context', async () => {
    await bus.publish(new CatalogDeletedEvent('c1'));
    await settle();

    expect(productRepo.archiveByCatalogId).toHaveBeenCalledWith('c1');
  });

  it('delivers UserCreated to the user context', async () => {
    await bus.publish(new UserCreatedEvent('u1', 'someone@example.com'));
    await settle();

    expect(profileRepo.save).toHaveBeenCalledTimes(1);
    const profile = profileRepo.save.mock.calls[0][0];
    expect(profile.userId).toBe('u1');
    expect(profile.email).toBe('someone@example.com');
    expect(profile.status).toBe('active');
  });

  it('does not deliver an event to the wrong handler', async () => {
    await bus.publish(new CatalogDeletedEvent('c1'));
    await settle();

    expect(profileRepo.save).not.toHaveBeenCalled();
  });
});
