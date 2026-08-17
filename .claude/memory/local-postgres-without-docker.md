---
name: local-postgres-without-docker
description: This environment has no Docker daemon but does have PostgreSQL 16 — initdb a cluster rather than mocking the database
metadata:
  type: reference
---

The session environment has **no Docker daemon**, but PostgreSQL 16 is
installed. A cluster is enough to turn asserted criteria into verified ones:

```bash
su postgres -c 'initdb -D /var/tmp/pet-pg --auth=trust'
su postgres -c 'pg_ctl -D /var/tmp/pet-pg -o "-p 5432" -l /var/tmp/pet-pg/log start'
createdb -h localhost -U postgres ddd_project
cd backend && pnpm migration:run
```

This is what made the difference between the specs' claims and their evidence —
the dropped `UserCreated` event, the collapsed refresh rotation and the
`3F000` migration failure were all invisible without a real database.

Two smaller notes:

- `pkill -f "node dist/main.js"` **kills the shell running it**, because the
  pattern matches its own command line (exit 144). Use `pkill -x node`.
- e2e specs need migrations applied first; they do not create schemas.
