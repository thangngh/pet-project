---
name: typeorm-per-context-traps
description: Three TypeORM traps hit while building per-context pools, schemas and migration histories
metadata:
  type: project
---

**1. `name` must be inside the factory return.** `TypeOrmModule.forRootAsync({ name })`
passes the **factory's** options to the shutdown hook, not the outer object. With
`name` only on the outer object, shutdown cannot find the `DataSource` and the
app fails to close.

```ts
TypeOrmModule.forRootAsync({
  name: context,
  useFactory: () => ({ name: context, /* ... */ }),  // ← required here too
})
```

**2. The schema must exist before the migration CLI runs.** TypeORM writes its
`migrations` bookkeeping table *into* the context schema **before** running the
migration that creates that schema — PG error `3F000`, schema does not exist.
`scripts/migrate.mjs` runs `src/ensure-schema.ts` first for this reason.

**3. Declare every index on the entity.** A hand-written `CREATE INDEX` in a
migration that the entity does not declare with `@Index('IDX_...')` shows as
drift in `migration:generate`, and the next generated migration **drops it**.
Run `pnpm migration:generate` on a clean database and expect an empty
migration; anything else is drift.
