# Integration events

Events that cross a bounded-context boundary live here, not in the publishing
context's `domain/`.

A bounded context may not import another context's domain types, so publisher
and subscriber cannot share an event class that lives inside either one. Before
this directory existed, each context declared its own copy of the class instead.
That does not work: `@nestjs/cqrs` binds a handler to the exact constructor
passed to `@EventsHandler(...)`, so a copy with a matching name is a different
event and the handler is never called.

Rules:

1. An event published to another context is declared here and imported by both
   sides.
2. It carries primitives only — no value objects, no entities. That is what
   keeps the subscriber free of the publisher's domain.
3. A context's own internal events stay in that context.
