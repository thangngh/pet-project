---
name: jwt-iat-one-second-granularity
description: Two JWTs with the same payload signed in the same second are byte-identical — refresh rotation collapsed silently because of it
metadata:
  type: project
---

JWT `iat` has **one-second** granularity. Two refresh tokens signed in the same
second from the payload `{ sub, type: 'refresh' }` are byte-identical, so the
new session's SHA-256 equalled the old one's and **rotation collapsed without
an error**: the "new" token was the old token.

Fixed by putting the session id in the payload:

```ts
const sessionId = randomUUID();
this.jwtService.sign({ sub, type: 'refresh', sid: sessionId }, ...);
```

Unit tests could not find this — they stub `jwtService.sign`. Only e2e, signing
real tokens fast enough to land in one second, exposed it. Anything whose
uniqueness depends on a timestamp needs a test that runs two of them back to
back.
