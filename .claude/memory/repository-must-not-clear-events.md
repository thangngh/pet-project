---
name: repository-must-not-clear-events
description: A repository that clears an aggregate's events drops every domain event before anything can publish it — silently, with 201 responses
metadata:
  type: project
---

`UserRepository.save()` called `user.clearEvents()`. The use case published
afterwards, so it published an empty array: **every `UserCreated` event was
dropped**, registration returned 201, and no profile was ever created.

Clearing is the caller's job, after the events are enqueued:

```ts
await this.outbox.transaction(async (tx) => {
  await this.repo.save(user, tx);
  await this.outbox.write(user.events, tx);
  user.clearEvents();
});
```

Why it survived review: the test that should have caught it **stubbed the very
repository at fault**, so the stub returned events the real code had already
thrown away. Only a live database exposed it.

The general shape: a test that mocks the component containing the defect
proves the test's own mock behaves, and nothing else.
