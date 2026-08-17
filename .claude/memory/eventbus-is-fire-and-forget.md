---
name: eventbus-is-fire-and-forget
description: "@nestjs/cqrs EventBus.publish returns void and swallows handler errors — it cannot back a retrying outbox"
metadata:
  type: project
---

`EventBus.publish` in `@nestjs/cqrs` v11 returns `void`. `DefaultPubSub.publish`
calls `subject$.next(event)`; `bind()` catches handler errors into an
`UnhandledExceptionBus` that **nothing in this project subscribes to**.

Consequence for the outbox: if the poller dispatched through `EventBus`, every
message would be marked delivered whether or not its handler succeeded, and
`attempts`, the exponential backoff and the give-up threshold would never fire
once. The outbox would pass a happy-path test and lose messages exactly when it
was supposed to save them.

That is why `IntegrationEventDispatcher` exists: handlers self-register in
`onModuleInit`, `dispatch()` **awaits** them and **throws** when none is
registered. The poller only marks a message dispatched if that promise resolves.

`EventBus` is still fine for within-context notification where a lost handler
does not lose data.
