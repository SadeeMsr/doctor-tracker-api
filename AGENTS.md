# Doctor Tracker API: rules for AI agents and contributors

This file is the source of truth for how code is written in this repo. Read it fully before
changing anything. If a rule blocks you, stop and ask; do not work around it.

## Project

REST API for an admin portal that manages doctors and their patients, with dashboard analytics.

- **Runtime:** Node 26 LTS (`.nvmrc`), ESM only (`"type": "module"`), pnpm 12.
- **Stack:** Express 5, TypeScript 6 (strict), Mongoose 9 on MongoDB, Zod 4, pino, Vitest.
- **Frontend:** a separate repo (`doctor-tracker-web`, Next.js). It proxies `/api/*` to this
  server, so the API never renders HTML and never assumes a browser origin.

## Commands

| Task                  | Command                                                            |
| --------------------- | ------------------------------------------------------------------ |
| Dev server (watch)    | `pnpm dev`                                                         |
| Lint / types / format | `pnpm lint` · `pnpm typecheck` · `pnpm format`                     |
| All tests             | `pnpm test` (unit + integration; MongoDB runs in memory, no setup) |
| One suite             | `pnpm test:unit` · `pnpm test:integration`                         |
| Build / start         | `pnpm build` · `pnpm start`                                        |
| Production indexes    | `pnpm db:sync-indexes` (after build)                               |
| Admin account         | `pnpm db:create-admin` (after build; reads `SEED_ADMIN_*`)         |

Run `pnpm lint && pnpm typecheck && pnpm test` before you say something is done.

## Architecture: Clean Architecture (non-negotiable)

```
src/
  domain/          entities, business rules, repository PORTS (interfaces), domain errors
  application/     use cases (services). Depend on domain ports only
  infrastructure/  adapters: Mongoose models + repositories, logger
  presentation/    HTTP adapter: Express routers, controllers, Zod schemas, presenters
  config/          env parsing (Zod). Read ONLY by the composition root and infrastructure
  container.ts     composition root: the ONLY place that picks concrete adapters
  server.ts        process entry: connect DB, build app, graceful shutdown
```

**Dependency rule:** dependencies point inward only. ESLint (`no-restricted-imports`) enforces it,
and lint must pass.

| Layer            | May import              | Must never import                                                                          |
| ---------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| `domain`         | other `domain` files    | application, infrastructure, presentation, config, express, mongoose, zod, any I/O library |
| `application`    | `domain`                | infrastructure, presentation, config, express, mongoose                                    |
| `infrastructure` | `domain`, `config`      | presentation, express                                                                      |
| `presentation`   | `domain`, `application` | infrastructure, config, mongoose                                                           |

Consequences you must respect:

- **IDs are plain `string`s** outside infrastructure. Never expose `ObjectId`, `_id`, Mongoose
  documents or `lean()` results past a repository. Map them with `toEntity()`.
- **Malformed ids are "not found".** Repositories return `null`/`false` for them; they never
  throw. The HTTP layer does not validate Mongo id formats.
- **Persistence errors are translated in the repository** (e.g. duplicate key `11000` →
  `ConflictError`). Nothing outside infrastructure knows Mongo error codes.
- **Config and logger are injected.** `createApp()` receives services, logger and options from
  `server.ts`. Never import `config/env` from `presentation` or `application`.

## Adding a feature: follow the `doctors` template exactly

Build one vertical slice at a time, in this order. Mirror the file names of the doctors module.

1. **Domain** `src/domain/<feature>/`
   - `<feature>.entity.ts`: entity interface, `New<Feature>` / `<Feature>Changes` types,
     enums as `as const` arrays, pure normalisation rules.
   - `<feature>.repository.ts`: the port, including list criteria and a JSDoc contract.
2. **Application** `src/application/<feature>/<feature>.service.ts`
   - A class with constructor-injected ports in `#private` fields. It throws domain errors
     (`NotFoundError`, `ConflictError`, ...), never HTTP errors.
3. **Infrastructure** `src/infrastructure/database/mongoose/`
   - `models/<feature>.model.ts`: schema, `timestamps: true`, `versionKey: false`, explicit
     `collection`, indexes with a comment explaining each. Export it from `models/index.ts`.
   - `repositories/mongo-<feature>.repository.ts`: `implements <Feature>Repository`.
4. **Presentation** `src/presentation/http/<feature>/`
   - `<feature>.schemas.ts` (Zod), `<feature>.presenter.ts`, `<feature>.controller.ts`,
     `<feature>.routes.ts`. Mount the router in `presentation/http/app.ts`.
5. **Wire** the repository and service in `src/container.ts`, and extend `AppDependencies`.
6. **Tests** (all required, see Testing):
   - a contract suite in `tests/contract/`
   - an in-memory fake in `tests/support/`
   - service unit tests
   - a Mongo contract run and HTTP integration tests

Do not create new top-level folders, "utils" grab-bags, base classes or generic repositories.

## HTTP conventions

- Base path `/api/v1`. Resource names are plural nouns: `/doctors`, `/doctors/:id/patients`.
- **Every handler is built with `handle(schemas, fn)`** from `presentation/http/shared/handle.ts`.
  It validates `params`/`query`/`body` with Zod and types `req` from the same schemas. Never
  read `req.body`/`req.query` without a schema, and never cast them.
- Express 5 forwards rejected promises, so there is no `asyncHandler` and no try/catch in
  controllers; let errors reach the error handler.
- **Response envelopes:**
  - Success: `{ data }`
  - Lists: `{ data: [], meta: { page, limit, total, totalPages, hasNextPage, hasPrevPage } }`,
    built with `toListResponse()`
  - Errors: `{ error: { code, message, details?, requestId } }`
- **Status codes:**
  - `200` read/update
  - `201` + `Location` on create
  - `204` on delete
  - `401` unauthenticated, `403` forbidden, `404` not found
  - `409` conflict
  - `422` validation
  - `429` rate limited
- Responses go through a presenter (`present<Feature>`). Never `res.json()` an entity or a
  database record directly. Dates are ISO strings.
- **Errors:** follow the "Error handling" section below. Controllers never write error
  responses themselves.
- **Lists:**
  - Always paginated (`paginationQuery`, max `limit` 100).
  - Filters are optional query params; `?x=` (empty) means "not provided" (`optionalText`).
  - Date filters use `from`/`to` via `dateRangeQuery`.
- Static routes are registered before `/:id` routes.

## Error handling

One path for every failure: **code throws → `error-handler.ts` translates → one response
shape**. Nothing else writes error responses.

### Who throws what

| Where                   | Throws                                                                      | Example                             |
| ----------------------- | --------------------------------------------------------------------------- | ----------------------------------- |
| `domain`, `application` | `DomainError` subclasses only (`domain/shared/errors.ts`)                   | `throw new NotFoundError('Doctor')` |
| `infrastructure`        | translates known driver errors to `DomainError`; lets unknown errors bubble | Mongo `11000` → `ConflictError`     |
| `presentation`          | `HttpError` for transport-only failures                                     | unknown route, rate limit, bad JSON |
| Zod (via `handle()`)    | `ZodError`, thrown automatically                                            | invalid body → `422`                |

- **Controllers:**
  - never `try/catch`
  - never `res.status(4xx|5xx).json(...)`
  - always throw (or let the service throw)
- **Catch only to translate or to add context.** Rethrow with `{ cause: error }` so the original
  stack survives. Empty `catch {}` blocks, and catch-then-return-`null` to hide a failure, are
  forbidden.
- **Expected outcomes are not exceptions inside repositories.** "Not found" is `null`/`false`
  (see the repository contract); the service turns it into `NotFoundError`.
- **Never throw strings or plain objects.** Throw `Error` subclasses.

### Status and code mapping (a public contract; the web app switches on `code`)

| Error                                        | Status | `code`                    | `details`                                                   |
| -------------------------------------------- | ------ | ------------------------- | ----------------------------------------------------------- |
| `ZodError`                                   | 422    | `VALIDATION_ERROR`        | `[{ path: 'email', message }]`                              |
| `InvalidInputError`                          | 422    | `VALIDATION_ERROR`        | optional, same shape                                        |
| Malformed JSON body                          | 400    | `BAD_REQUEST`             | none                                                        |
| `UnauthorizedError`                          | 401    | `UNAUTHORIZED`            | none                                                        |
| `ForbiddenError`                             | 403    | `FORBIDDEN`               | none                                                        |
| `NotFoundError` / unknown route              | 404    | `NOT_FOUND`               | none                                                        |
| `ConflictError`                              | 409    | `CONFLICT`                | `{ fields: ['email'] }` when a unique field clashes         |
| Idempotency key reused with a different body | 422    | `IDEMPOTENCY_KEY_REUSED`  | none                                                        |
| Same idempotency key still in flight         | 409    | `IDEMPOTENCY_IN_PROGRESS` | none                                                        |
| Rate limit                                   | 429    | `TOO_MANY_REQUESTS`       | none (plus `RateLimit` headers)                             |
| Anything else                                | 500    | `INTERNAL_ERROR`          | none (a stack only when `exposeErrorStack` is on, i.e. dev) |

- **Error codes:**
  - `SCREAMING_SNAKE_CASE`, stable, never renamed
  - adding one means adding it to the `DomainErrorCode` or `HttpErrorCode` union, the mapping
    in `error-handler.ts`, this table, and the web app's message map, in the same change
- **Messages are written for an admin user, not a developer:** "A doctor with this email
  already exists", not "E11000 duplicate key". Never echo raw input, internal ids of other
  records, query text or driver messages.
- **Every error response carries `requestId`** (also the `X-Request-Id` header). The same id is
  on the log line, so a user report can be matched to the log.

### Logging errors

- `4xx` → `req.log.warn({ code, message })`: no stack, because it's the client's fault and
  expected.
- `5xx` → `req.log.error({ err })` with the full error, stack and `cause` chain. This happens
  once, in the error handler. Don't also log at the throw site.

### Process-level failures (crash-only design)

- `unhandledRejection` and `uncaughtException` → log `fatal` and `process.exit(1)`; the
  platform (Render) restarts the process. Never keep running in an unknown state.
- If startup fails (bad env, DB unreachable), exit non-zero immediately (`config/env.ts`,
  `bootstrap().catch`).
- `SIGTERM`/`SIGINT` → graceful shutdown: stop accepting connections, drain, close the DB, exit
  `0`. Force-exit after 10 s.
- `/health` returns `503` when the database is down, so the platform can route around it.

### Testing errors

Every new endpoint gets integration tests for its failure paths. Assert the **status, `code`
and `details` shape**, not just "it fails":

- validation → 422 with the field `path`s
- not found → 404, including a malformed id
- conflict → 409, if a unique field exists
- unauthenticated → 401, once auth exists

## Idempotency

Retries happen: double-clicks, flaky mobile networks, the client's refresh-and-retry, platform
restarts mid-request. Every endpoint must be safe to receive twice.

### Rules by HTTP method

| Method          | Guarantee                                                        | How                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`, `HEAD`   | **Safe**: no writes, ever                                        | No side effects in read handlers: no "last viewed" updates, no lazy writes.                                                                                                                             |
| `PATCH`         | **Idempotent**                                                   | Absolute assignments only: `{ hospital: 'X' }`. Never `$inc`, `$push`, toggles or "append" from client input. Sending the same body twice gives the same state.                                         |
| `PUT`           | **Idempotent**                                                   | Full replacement. Not used yet; prefer `PATCH`.                                                                                                                                                         |
| `DELETE`        | **Idempotent in effect**                                         | The first call returns `204`; a repeat returns `404`. The server state is identical either way (RFC 9110 defines idempotency by state, not by response). Clients treat `404` on delete as already done. |
| `POST` (create) | **Not idempotent by default; made safe** by the two layers below |                                                                                                                                                                                                         |

### Making `POST` creates safe

1. **Natural-key uniqueness (always).**
   - Every entity with a real-world identity has a unique index on it (doctor `email`).
   - A retried create then hits `409 CONFLICT` instead of creating a duplicate.
   - The repository translates `11000` → `ConflictError`, which is already implemented for
     doctors.
2. **`Idempotency-Key` header (required on create endpoints that lack a natural key, such as
   patients; optional on the others).**
   - The client sends a UUID per logical submit and reuses it on retries.
   - The server keeps the first response for **24 h**, scoped by user + method + path + key, and
     replays it.

   | Situation                               | Response                                                                   |
   | --------------------------------------- | -------------------------------------------------------------------------- |
   | New key                                 | Process normally; store status + body + a SHA-256 hash of the request body |
   | Same key, same body, finished           | Replay the stored status and body, plus header `Idempotent-Replayed: true` |
   | Same key, same body, still processing   | `409 IDEMPOTENCY_IN_PROGRESS` (the client retries shortly)                 |
   | Same key, **different** body            | `422 IDEMPOTENCY_KEY_REUSED`                                               |
   | No key on an endpoint that requires one | `400 BAD_REQUEST`                                                          |
   | A request that failed with a 5xx        | Don't store it; the key can be retried                                     |
   - **Where it lives:**
     - port: `application/ports/idempotency-store.ts`
     - Mongo adapter: `infrastructure/.../repositories/mongo-idempotency-store.ts` (collection
       `idempotency_keys`, unique index on the scoped key, TTL index on `createdAt`)
     - middleware: `presentation/http/middleware/idempotency.ts`, injected via `AppDependencies`
     - tests: `tests/contract/idempotency-store.contract.ts` and
       `tests/integration/idempotency.http.test.ts`
   - **Using it on a route:** `router.post('/', idempotent({ required: true }), controller.create)`.
     The router factory receives `idempotent` from `app.ts`.
   - A claim left unfinished for 60 s (the process died mid-request) can be taken over.
   - Claim the key atomically with an insert (unique index) **before** running the handler.
     Never "check, then insert": that check-then-act gap is a race.

### Other idempotency rules

- **Multi-document writes** (e.g. deleting a doctor together with their patients) run inside
  `session.withTransaction()`. It retries transient errors, so the work inside must be safe to
  repeat: no external side effects inside a transaction.
- **Auth:**
  - **Logout always returns `204`** and clears the cookies, even with no session or one that's
    already revoked.
  - **Rotate refresh tokens with one conditional atomic update** (`revokeIfActive`: matches the
    hash, unrevoked and unexpired), so two concurrent refreshes can't both rotate.
  - **A rotated token reused after the grace window is token theft.** Revoke all of that user's
    sessions (see Security rules).
- **Scripts:**
  - `pnpm db:create-admin` and `pnpm seed` upsert by natural key (`email`), so running them
    twice gives the same data, not double
  - `db:sync-indexes` is naturally repeatable
- **Server-side retries:**
  - Keep `retryWrites=true` in the Mongo URI; the driver's retryable writes are exactly-once.
  - Never add your own retry loop around a non-idempotent operation.

## MongoDB / query rules (this is graded: query optimisation)

- **Every filter or sort a list endpoint exposes must be backed by an index.**
  - Order compound indexes Equality → Sort → Range (ESR).
  - Document why each index exists in the model file.
- **Reads:**
  - always `.lean()`
  - always pass an explicit projection
  - fetch the page and `countDocuments` in parallel with `Promise.all`
  - add `_id` as a sort tie-breaker so pagination is stable
- **Search:**
  - anchored, case-insensitive prefix match on a denormalised lowercase field (see
    `nameLower`), built with `prefixRegex()`, which escapes input
  - never build a `RegExp` from raw user input
  - never use unanchored `/x/i` regexes, `$where` or `$expr` on user input
- **Relations:** reference by id (patients store `doctorId`); do not embed unbounded arrays.
- **Aggregations:**
  - start with `$match` on indexed fields
  - `$sort` + `$limit` before `$lookup`
  - project early
  - verify with `explain('executionStats')` when adding one
- **Writes:**
  - `runValidators: true` on updates
  - `returnDocument: 'after'`
  - keep denormalised fields (e.g. `nameLower`) in sync in the repository
- **Multi-document invariants** (e.g. deleting a doctor and their patients) need a transaction
  (`session.withTransaction`) or an explicit block; decide in the service and document it.
- Indexes build automatically in dev/test (`autoIndex`); production uses `pnpm db:sync-indexes`.

## TypeScript & code style

- **Strict TS, plus:**
  - `noUncheckedIndexedAccess`
  - `verbatimModuleSyntax`
  - `erasableSyntaxOnly`: no constructor parameter properties, no `enum`, no `namespace`.
    Declare fields explicitly; use `as const` arrays + union types instead of enums.
- **Imports:**
  - relative imports with explicit `.js` extensions (NodeNext ESM)
  - `import type` for types (enforced)
  - no path aliases, no barrel files (except `models/index.ts`)
- **Names:**
  - files are kebab-case with a role suffix (`*.entity.ts`, `*.repository.ts`, `*.service.ts`,
    `*.model.ts`, `*.controller.ts`, `*.routes.ts`, `*.schemas.ts`, `*.presenter.ts`)
  - classes PascalCase; functions and variables camelCase
  - Mongo adapters are prefixed `Mongo`; test fakes `InMemory`
- **No `any`**, no non-null `!` assertions, no `as unknown as` except at a framework boundary,
  with a comment explaining why.
- `eslint-disable` only for a single line, with a comment giving the reason. Never weaken
  `eslint.config.js`, `tsconfig.json` or the Prettier config to make an error go away.
- Comments explain **why**, not what. Public ports and non-obvious decisions get JSDoc.
- **Logging:**
  - use `req.log` in request scope, or the injected logger elsewhere
  - `console.*` is forbidden (except `console.error` in `config/env.ts` before the logger
    exists)
  - never log secrets, tokens, passwords, cookies or full request bodies

## Security rules

- **Passwords:** argon2id via the `PasswordHasher` port (`Argon2PasswordHasher`). Never store
  or log plaintext. Login verifies against a dummy hash for unknown emails, so timing doesn't
  reveal which accounts exist.
- **Tokens** (`AuthService` + the `TokenService` port):
  - **Access token:** HS256 JWT, 15 min, with `iss`/`aud`/`sub` claims. Verified statelessly; the
    algorithm is pinned on verify, never taken from the token header.
  - **Refresh token:** an opaque 32-byte random string, never a JWT. Only its SHA-256 is stored,
    in a `sessions` record (TTL-deleted at expiry).
  - **Rotation:** every refresh revokes the old session (`revokedReason: 'rotated'`) and creates
    a new one, as one atomic conditional update.
  - **Reuse:** a `rotated` token presented again within `ROTATION_GRACE_MS` (10 s) is a
    concurrent tab, so it gets `204` with no new cookies. Later than that, it's theft: revoke
    every session of the user (`reuse-detected`). Logged-out or locked-out tokens never get the
    grace window.
- **Cookies** (`presentation/http/auth/auth.cookies.ts`):
  - `dt_access` / `dt_refresh`, `httpOnly`, `sameSite=lax` (the CSRF defence), `path=/`, no
    domain, `secure` in production
  - never put tokens in response bodies or localStorage
  - a failed refresh **clears both cookies**, or the web proxy would loop between `/login` and
    the dashboard
- **Protecting routes:**
  - mount new routers behind `requireAuth` in `presentation/http/app.ts`
    (`api.use('/x', requireAuth, createXRouter(...))`)
  - only `/health` and `/auth/login|refresh|logout` are public
  - handlers read the caller with `getAuth(req)`; role checks use `requireRole(...)`
- **Login errors:** one generic message for every failure ("Invalid email or password"), and
  `createLoginRateLimiter()` (10 failed attempts per 15 min per IP) guards login.
- **Accounts:** there's no sign-up. `pnpm db:create-admin` provisions the admin from
  `SEED_ADMIN_*` env vars, and running it again just resets the password.
- Validate everything at the edge with Zod; the domain trusts typed input but still normalises.
- **Secrets:**
  - only in `.env` (git-ignored); new variables go in `config/env.ts` (with validation) and
    `.env.example` (with a placeholder) in the same change
  - never hard-code a secret, URI or credential

## Testing rules

- **Unit** (`tests/unit/`): services tested with in-memory fakes. No database, no HTTP.
- **Contract** (`tests/contract/`): one `describe<Feature>RepositoryContract()` per port. It runs
  against both the in-memory fake (unit) and Mongo (integration). If they disagree, fix the
  fake or the adapter, never the contract.
- **Integration** (`tests/integration/`):
  - Supertest against `buildTestApp()`, using `useMongoMemoryServer()` for real indexes
  - assert status, envelope shape and error `code`, not just "it works"
- Build test data with the builders in `tests/support/fixtures.ts`. Tests are independent
  (collections are wiped after each test) and never hit the network or a real database.
- A bug fix starts with a failing test.

## Git workflow

- One branch per slice: `feat/<slice>`, `fix/<thing>`, `chore/<thing>`. Never commit to `main`
  directly; merge via PR with CI green.
- Conventional Commits (commitlint enforces): `feat(doctors): add hospital filter`.
- **Hooks:** pre-commit runs lint-staged + typecheck, and pre-push runs the tests. Never bypass
  them (`--no-verify`, `HUSKY=0`); fix the cause.
- Never commit `.env`, credentials, `dist/` or coverage output. Never hand-edit `pnpm-lock.yaml`.

## Boundaries: ask before you

- add, remove or upgrade a dependency
- change the architecture, folder layout, response envelope, error codes or lint/TS config
- change an existing index or a public endpoint's contract
- delete or rewrite tests
- do anything not asked for (no drive-by refactors, no speculative abstractions, no new
  features "while you're there")

## Definition of done

- [ ] It follows the layer rules and the doctors template.
- [ ] Inputs are validated; errors map to the right status and code, and failure paths are
      tested.
- [ ] Repeating any request is safe: PATCH only assigns values, creates hit a unique index or
      `Idempotency-Key`, and DELETE leaves the same state.
- [ ] Every new query filter/sort is indexed, and each index is justified in a comment.
- [ ] Tests are written (contract + unit + integration as applicable) and pass.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.
- [ ] You exercised it for real (curl or the web app) and reported exactly what was verified.
- [ ] No TODOs, dead code, commented-out code or stray `console` calls.
- [ ] `.env.example` and the README are updated if config or setup changed.
