# Pet E-commerce

DDD + Hexagonal Architecture (Ports & Adapters) — monolithic NestJS 10 API.

## Structure

```
├── backend/                     # all source
│   ├── src/                     # application code
│   │   ├── modules/             # bounded contexts: auth, user, catalog, product
│   │   └── shared/              # shared kernel
│   ├── test/                    # e2e tests
│   ├── scripts/migrate.mjs      # per-context migration CLI
│   └── .env.example
├── docs/                        # specs, ADRs, audit, gates
├── CLAUDE.md                    # architecture + agent instructions
├── docker-compose.yml           # one PostgreSQL, shared by every context
├── docker-compose.multi-db.yml  # one PostgreSQL per context
└── LICENSE
```

## Quick start

```bash
cd backend
cp .env.example .env
pnpm install

docker compose up -d      # from the repo root — PostgreSQL 16 on :5432

pnpm migration:run        # REQUIRED — nothing creates tables at boot
pnpm seed:admin           # the only way to create the first admin
pnpm start:dev            # :3001
```

`pnpm migration:run` is not optional. `synchronize` is off on every data
source, so skipping it gives a process that starts and then fails every
request with `relation does not exist`.

Check it came up:

```bash
curl localhost:3001/health     # unprefixed, so probes survive a version bump
```

Everything else is under `/api/v1`.

## Databases

Each bounded context has its own connection pool and its own PostgreSQL
schema, and its own migration history. By default all four share one server:

```
DB_<CONTEXT>_<SETTING>  ->  DB_<SETTING>  ->  built-in default
```

Setting a context's `HOST` and `DATABASE` moves it to a database of its own
with no code change. `docker-compose.multi-db.yml` provides the servers for
that; `backend/.env.example` has the variables, commented out.

```bash
# one shared server (default)
docker compose up -d

# one server per context
docker compose -f docker-compose.multi-db.yml up -d

docker compose down -v    # reset all data
```

| Context | Schema | Service in multi-db | Port |
|---------|--------|---------------------|------|
| Auth | `auth` | `postgres_auth` | 5432 |
| User | `user` | `postgres_user` | 5433 |
| Catalog | `catalog` | `postgres_catalog` | 5434 |
| Product | `product` | `postgres_product` | 5435 |

Do not point a context at one of these ports until the matching service is
running, or that context boots against nothing.

## Migrations

Per context — a `revert` on one cannot touch another.

```bash
cd backend
pnpm migration:run                                   # every context
pnpm migration:show                                  # every context
pnpm migration:revert   --context=catalog
pnpm migration:generate --context=catalog --name=AddThing
```

## Tests

```bash
cd backend
pnpm test        # unit
pnpm test:e2e    # needs a live database with migrations applied
pnpm lint
```

## Documentation

`CLAUDE.md` is the architecture reference. Every claim in it is marked
**[built]** or **[plan]**, because it was once a plan that got read as a
description — see `docs/audit/audit-2026-08-17.md`.

## License

**Commercial use** requires a paid license.
**Module use** requires a public fork of modified source.

See [LICENSE](./LICENSE) for full terms.
