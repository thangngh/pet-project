import { Test, TestingModule } from '@nestjs/testing';
import { CatalogDeletedEvent } from './catalog-deleted.event';
import { UserCreatedEvent } from './user-created.event';
import { INTEGRATION_EVENTS, reconstructEvent } from './registry';
import { IntegrationEventDispatcher } from '../../outbox/integration-event-dispatcher';
import { CatalogDeletedHandler } from '../../../../modules/product/application/handlers/catalog-deleted.handler';
import { UserRegisteredHandler } from '../../../../modules/user/application/handlers/user-registered.handler';
import { PRODUCT_REPOSITORY } from '../../../../modules/product/domain/ports/product.repository.port';
import { USER_PROFILE_REPOSITORY } from '../../../../modules/user/domain/ports/user-profile.repository.port';

/**
 * Routes events through the real dispatcher rather than a mock. A handler
 * registered for the wrong class — or for no class at all — still compiles and
 * still passes a unit test that calls `handle()` directly, so only a round
 * trip shows whether the wiring exists.
 *
 * This used to go through the CQRS EventBus. The outbox cannot: EventBus
 * .publish returns void and runs handlers detached, so a message would be
 * marked delivered whether or not the handler succeeded, and the retry
 * machinery would never fire. See IntegrationEventDispatcher.
 */
describe('integration events', () => {
  let moduleRef: TestingModule;
  let dispatcher: IntegrationEventDispatcher;

  const productRepo = { archiveByCatalogId: jest.fn() };
  const profileRepo = { save: jest.fn(), findByUserId: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    profileRepo.findByUserId.mockResolvedValue(null);

    moduleRef = await Test.createTestingModule({
      providers: [
        IntegrationEventDispatcher,
        CatalogDeletedHandler,
        UserRegisteredHandler,
        { provide: PRODUCT_REPOSITORY, useValue: productRepo },
        { provide: USER_PROFILE_REPOSITORY, useValue: profileRepo },
      ],
    }).compile();

    // Handlers register themselves in onModuleInit.
    await moduleRef.init();
    dispatcher = moduleRef.get(IntegrationEventDispatcher);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('delivers CatalogDeleted to the product context', async () => {
    await dispatcher.dispatch(new CatalogDeletedEvent('c1'));

    expect(productRepo.archiveByCatalogId).toHaveBeenCalledWith('c1');
  });

  it('delivers UserCreated to the user context', async () => {
    await dispatcher.dispatch(
      new UserCreatedEvent('u1', 'someone@example.com'),
    );

    expect(profileRepo.save).toHaveBeenCalledTimes(1);
    const profile = profileRepo.save.mock.calls[0][0];
    expect(profile.userId).toBe('u1');
    expect(profile.email).toBe('someone@example.com');
    expect(profile.status).toBe('active');
  });

  it('does not deliver an event to the wrong handler', async () => {
    await dispatcher.dispatch(new CatalogDeletedEvent('c1'));

    expect(profileRepo.save).not.toHaveBeenCalled();
  });

  it('propagates a handler failure, so the outbox can retry the message', async () => {
    // The property the whole outbox rests on. Through the CQRS bus this
    // rejection would vanish into an UnhandledExceptionBus nothing subscribes
    // to, and the message would be marked delivered.
    productRepo.archiveByCatalogId.mockRejectedValue(new Error('db is down'));

    await expect(
      dispatcher.dispatch(new CatalogDeletedEvent('c1')),
    ).rejects.toThrow('db is down');
  });

  it('refuses to silently succeed for an event with no handler', async () => {
    class UnregisteredEvent extends CatalogDeletedEvent {}

    await expect(
      dispatcher.dispatch(new UnregisteredEvent('c1')),
    ).rejects.toThrow(/No handler registered/);
  });

  describe('the outbox registry', () => {
    it('reconstructs an event as the same class the handler expects', () => {
      const event = reconstructEvent(
        'CatalogDeletedEvent',
        { catalogId: 'c1' },
        new Date('2026-08-17T00:00:00Z'),
      );

      expect(event).toBeInstanceOf(CatalogDeletedEvent);
      expect((event as CatalogDeletedEvent).catalogId).toBe('c1');
      expect(event.occurredOn.toISOString()).toBe('2026-08-17T00:00:00.000Z');
    });

    it('keys every entry by the name instances actually carry', () => {
      // `eventName` comes from `constructor.name`, so a rename would orphan
      // every message already in the outbox — undispatched forever, while the
      // writes keep succeeding and the system looks healthy.
      expect(new CatalogDeletedEvent('c1').eventName).toBe(
        'CatalogDeletedEvent',
      );
      expect(new UserCreatedEvent('u1', 'a@b.c').eventName).toBe(
        'UserCreatedEvent',
      );

      for (const [name, ctor] of Object.entries(INTEGRATION_EVENTS)) {
        expect(ctor.name).toBe(name);
      }
    });

    it('names the fix when an event is not registered', () => {
      expect(() => reconstructEvent('NoSuchEvent', {}, new Date())).toThrow(
        /INTEGRATION_EVENTS/,
      );
    });
  });
});
