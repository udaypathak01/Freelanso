# Freelanso API foundation

Requires Node.js 20 or newer. This package is independent of the Vite frontend
and exports the Express app from `src/app.js` for Supertest.

## Configure and run

1. Copy `.env.example` to `.env` and set `FIREBASE_PROJECT_ID` and
   `CORS_ALLOWED_ORIGINS`.
2. Configure Google Application Default Credentials or set
   `GOOGLE_APPLICATION_CREDENTIALS` to a service-account file outside this
   repository. Never commit service-account credentials.
3. Install dependencies and run the API:

   ```powershell
   npm install
   npm run dev
   ```

Set `FIREBASE_DATABASE_URL` to the URL for the project's Realtime Database
instance (the default `<project-id>-default-rtdb` URL is used when omitted).
For the Vite frontend, set `VITE_API_URL` to the backend API base URL
(`http://localhost:5000/api` in local development). In production, set it to
the deployed backend's HTTPS `/api` URL, and set `CORS_ALLOWED_ORIGINS` to the
exact deployed frontend origin(s), comma-separated. Replace the example origin
in `.env.example`; do not use a wildcard.
The authenticated conversation-creation route and RTDB membership rules require
this database to be enabled. Deploy `database.rules.json` alongside the server
configuration; clients read only their `userConversations/{uid}` index and can
read/write conversation content only when the canonical `participantsMap`
contains their verified UID. To convert legacy object-valued `participants`,
run `npm run migrate:conversations -- --dry-run`, inspect the count, then run
`npm run migrate:conversations`.

Cloudinary credentials and both upload presets are optional until uploads are
enabled; configure the cloud name, API key, API secret, profile preset, and
project preset together. Battle image uploads also require a dedicated signed
`CLOUDINARY_BATTLE_UPLOAD_PRESET`; configure it to allow only JPG, PNG, and
WebP images up to 5 MB. Configure this preset in Cloudinary, because a
browser-side file check is not a security boundary. All upload presets must be
**signed**. Configure the profile
preset to allow JPG, PNG, GIF, and WebP up to 5 MB. Configure the project
preset to allow JPG, PNG, and WebP images plus MP4, MOV, and WebM videos up to
100 MB. Cloudinary enforces those restrictions; the API signature binds the
preset and per-user asset folder. Never expose the Cloudinary API secret in the
browser. To enable the selected Google Gemini provider, configure
`AI_PROVIDER=gemini`, `AI_MODEL=gemini-2.5-flash`, and `AI_API_KEY` together.
All three may be left blank to use deterministic-only search; AI ranking then
degrades to the same keyword ranking without fabricating results. Smart search
requires Firebase authentication, allows 20 requests per user per UTC day,
caches identical user queries for 30 seconds, and falls back when Gemini
times out, fails validation, or is unavailable. Model prompts contain only the
bounded public project candidates and the user's query; prompts and secrets are
never logged. The provider makes at most two exponential-backoff retries; each
attempt is capped at 9 seconds so all attempts fit within the default
30-second API request timeout. At most ten
deterministically selected candidates are sent to Gemini, while the complete
candidate result page remains available through deterministic ranking.

The server validates configuration during startup, listens on `PORT` (default
5000), and enforces HTTPS when `NODE_ENV=production`. `TRUST_PROXY` defaults to
`false`, except on Render where it defaults to the platform's single proxy hop;
an explicit value overrides either default. For other deployments, set it only
to the known proxy hop count or a deliberate Express trust proxy value for the
deployment topology. Root `HEAD` requests are answered for platform health
probes before HTTPS enforcement.

## Endpoints

- `GET /healthz` reports process liveness.
- `GET /readyz` probes Firestore connectivity.
- `GET /api/me` requires a non-revoked Firebase ID token and returns the
  verified user's public identity DTO and lazily bootstraps the profile.
- `GET /api/dashboard` returns only the caller's projects/services, status
  counts, project engagement aggregates, application counts, and real profile
  rating statistics.
  Listing arrays are bounded to 20 items by default (max 50) and expose separate
  project/service cursors. Earnings remain zero with a null currency until a
  ledger exists. Satisfaction is null until at least one rating exists.
- `GET /api/users/me` returns the authenticated user's private profile.
- `GET /api/users/:uid` returns only public profile fields.
- `PUT /api/users/:uid` updates an owner or admin-managed profile.
- `POST /api/users/onboarding` sets the initial freelancer/client role.
- `POST /api/uploads/sign` signs an authenticated profile-photo upload.
- `GET /api/projects` returns published projects with q/category/skills/price
  filters, five sort modes, filter metadata, and cursors.
- `GET /api/projects/:id` returns a published project or its owner's draft.
- `GET /api/projects/mine` returns the authenticated user's projects.
- `POST /api/projects` publishes a freelancer-owned project.
- `PUT /api/projects/:id` and `DELETE /api/projects/:id` modify/delete an
  owned project; deletion cascades Firestore subcollections.
- `POST /api/projects/:id/like` transactionally toggles one like per user.
- `GET` and `POST /api/projects/:id/comments` list and create comments;
  `DELETE /api/projects/:id/comments/:commentId` allows the author, owner, or
  admin to moderate a comment.
- `GET /api/meta/categories` returns the canonical service-category slugs and
  labels used by the frontend, services API, migration, and seed.
- `GET /api/services` returns cursor-paginated published services with q,
  category, skills, price filters, five sort modes, and filter metadata.
- `GET /api/services/:id` returns a published service and public owner summary.
- `POST /api/services` creates a freelancer/admin-owned service.
- `PUT /api/services/:id` and `DELETE /api/services/:id` require service
  ownership or admin role.
- `GET /api/jobs` returns cursor-paginated open jobs with text search, category,
  skills, budget, job type, location, and sort filters.
- `GET /api/jobs/:id` returns a job and public owner summary.
- `POST /api/jobs` creates a job for a client or admin; `PUT` and `DELETE`
  require the job owner or an admin. Deletion is a soft delete.
- `POST /api/jobs/:id/applications` accepts a freelancer's cover letter and
  proposed rate. Deterministic application IDs and a transaction ensure a user
  can apply only once and the job application count stays in sync.
- `GET /api/applications/me` lists the caller's applications;
  `GET /api/jobs/:id/applications` is restricted to that job's owner.
- `PATCH /api/applications/:id/status` enforces the application status state
  machine: owners may move submitted applications to shortlisted, rejected, or
  hired; applicants may withdraw submitted or shortlisted applications.
- `GET /api/battles` lists cursor-paginated battles with `all`, `live`, or
  `ended` filters and an optional category.
- `GET /api/battles/:id` returns the public battle DTO and, when authenticated,
  the caller's vote. Legacy `entry_A`/`entry_B` and vote fields are mapped from
  canonical options for the existing UI.
- `POST /api/battles` creates a battle with two to six options; the creator ID,
  option IDs, initial status, and counts are server-controlled.
- `POST /api/battles/:id/vote` records one vote per authenticated user in a
  Firestore transaction. Creators may vote. Expired battles are lazily closed;
  ties are recorded with a null winner option.
- `POST /api/search/smart` ranks a bounded set of public projects with Gemini
  2.5 Flash and deterministic keyword fallback. It returns hydrated project
  DTOs only from the Firestore candidate set; `meta.degraded` indicates
  deterministic fallback.
- `POST /api/matches/score-all` returns deterministic freelancer profiles
  ranked for the caller-owned project. It uses configured skill, category,
  budget, rating, and recency weights and does not persist scores.
- `POST /api/support/tickets` accepts optional-auth support requests, validates
  the honeypot, rate-limits to five per IP and signed-in UID per hour, and
  supports `Idempotency-Key`. Signed-in users can list their tickets at
  `GET /api/support/tickets/me`; admins can list tickets and transition status.
- `POST /api/conversations` accepts only `recipientUid`. The caller is always
  derived from the verified token; a deterministic pair key reuses existing
  conversations. Canonical RTDB records store `participants` as an array and
  `participantsMap` for access checks. Messaging remains in Realtime Database.
- `GET /api/wallet` returns the caller's integer minor-unit available/pending
  balances. `POST /api/withdrawals` requires `Idempotency-Key` and atomically
  reserves available funds, writes a pending withdrawal, and appends a ledger
  entry. `GET /api/withdrawals/me` lists the caller's requests. Admin status
  transitions append ledger entries; rejection restores funds in the same
  transaction. Approval is internal/manual only and **does not execute a
  Stripe Connect payout**.
- `POST /api/uploads/sign` accepts purpose `battle` for a per-user battle
  folder and the dedicated image-only preset.
- Application and job lists use bounded cursor pagination. Job `popular` sort
  orders by application count, then creation time and document ID descending.
- `npm run seed:jobs` idempotently seeds the six legacy job examples and
  associated demo client profiles; seeding is disabled in production and
  requires development mode or the Firestore emulator.
- `openapi.yaml` documents these endpoints and their response envelopes.

Withdrawal limits default to INR 100.00 minimum and INR 10,000.00 maximum,
stored as paise (`WITHDRAWAL_MIN_MINOR=10000`, `WITHDRAWAL_MAX_MINOR=1000000`).
Balances are never writable through public API input. No client endpoint
credits wallets; future deposit/earning flows must append corresponding ledger
entries and update balances atomically. Stripe Connect was selected as the
future payout provider, but credentials, onboarding, transfers, and webhook
handling are not enabled in this phase.

Marketplace text search uses the `searchKeywords` array through the
`FirestoreSearchProvider` interface. Search terms are Unicode-normalized,
case-insensitive, tokenized, and capped at 30; Firestore fetches matching
candidates and the provider ranks each cursor page by the number of matched
terms. Empty tokenized queries return no results. Search is literal and never
interprets quotes, `$`, regular expressions, or other query syntax. Queries
over 80 characters and comma-separated skills lists over 10 values are rejected.
The provider can be replaced without changing route controllers.

Project sorts are `newest`, `oldest`, `price_asc`, `price_desc`, and `popular`.
Popular projects are ordered by likes descending, views descending, creation
time descending, then document ID descending. Services use the same sort
values; their `popular` order uses rating average, rating count, creation time,
and ID, all descending. Price sorts use creation time and ID descending as
stable tie-breakers. When a price range is combined with a non-price sort, the
shared cursor paginator applies the range while scanning the requested sort
order in bounded batches (up to 500 candidate documents per request), so
results keep the requested order without skipping candidates. `meta.total` is
included when Firestore can count the complete filtered query cheaply; it is
omitted when an in-memory filter is required. `meta` always includes `limit`,
`nextCursor`, and `appliedFilters`.

Every marketplace filter/sort query combination and dashboard engagement
aggregate is checked against `firestore.indexes.json` by `npm run test:indexes`.
New indexes must be deployed with the Firebase CLI before the corresponding
queries will work against a hosted Firestore database.

Service categories are stored as slugs (`design-creative`, `video-animation`,
`writing-translation`, `digital-marketing`, `tech-development`, `ai-automation`,
`business-legal`). `npm run migrate:categories -- --dry-run` previews legacy
category changes; `npm run migrate:categories` applies them idempotently. Both
commands are disabled in production. The six development service examples can
be seeded with `npm run seed:services`; the seed is idempotent and production
guarded. It preserves only source titles, prices, and category intent, uses
five delivery days and one revision, and leaves skills/images empty so it does
not fabricate Cloudinary URLs or media metadata. Demo owner profiles have
deterministic `seed-*` IDs.

Project media uploads request a signed `/api/uploads/sign` signature bound to
`users/{uid}/projects`; the Cloudinary API secret remains server-only. Project
delete attempts Cloudinary cleanup and persists retry jobs in
`cloudinaryDeletionQueue`; the server worker retries transient failures with
exponential backoff. Project views use a hashed user ID or IP and are counted
once per fixed 24-hour window.

Authenticated notifications are stored at `notifications/{uid}` in Realtime
Database. Users can read their own notification records; only the API writes
records and marks them read. Deploy `database.rules.json` when deploying these
rules. Incoming messages, project likes/comments, and job application changes
create notification entries.

The authenticated dashboard uses existing `jobs`, `projects`, and `services`
collections for role-specific feeds. Clients can publish jobs with a fixed or
hourly budget, required project duration, work mode, optional deadline and
experience level, and additional details. Published open jobs are visible to
all users in Browse Jobs, and freelancers can apply. `GET /api/jobs/mine`
returns only the caller's job posts. Job owners can edit their posts and review
or update applications from the job detail page.

The signup screen's selected freelancer/client role is sent to the one-time
onboarding endpoint. Other role changes are restricted to the server-side
admin command:

```powershell
npm run set-role -- <firebase-uid> <freelancer|client|admin>
```

Run that command only in a trusted administrative environment using privileged
Application Default Credentials or the configured service account. The command
preserves other Firebase custom claims. Users' phone and street-address fields
are stored in their private profile DTO and omitted from public profile reads.
Profile documents store the role mirrored from verified Firebase custom
claims; request bodies and legacy client-written role fields are never used as
authorization input. Firebase Authentication sign-in methods remain
client-side and unchanged.

Dashboard counters use Firestore count/sum aggregations scoped by the verified
UID. Listing edits and deletes continue through the existing project/service
endpoints, then the dashboard reloads its aggregates. There is no dashboard
cache, so listing writes cannot leave cached counts stale.

Success and error payloads use the common response envelope. Error responses
never contain stack traces or raw Firebase errors. Request IDs are returned in
`X-Request-Id` and error payloads.

## Checks and emulators

```powershell
npm run lint
npm test
npm run test:coverage
npm run test:indexes
npm run test:emu
```

`test:emu` starts the Firebase Auth and Firestore emulators from
`firebase.json`, runs the full test suite (including a real emulator-issued
ID-token test), then stops the emulators. Local unit/integration tests mock
Firebase Auth token verification and Firestore readiness, so they do not need
credentials or emulator processes.

The emulator Firestore rules deny all direct client access, consistent with
the server-only Firestore data path. Admin SDK operations bypass client
security rules.

## Hardening and deployment checks

The deny-by-default Firestore rules are tested by
`tests/firestoreRules.emulator.test.js`; RTDB conversation membership and
message-write restrictions are tested by
`tests/conversations.emulator.test.js`. Run only those security tests with:

```powershell
npm run test:rules
```

The maintained `openapi.yaml` is checked against every Express route and
method:

```powershell
npm run openapi:check
```

The `load:test` script runs a bounded Autocannon sample against the local
emulator-backed API: 100 public project-list requests followed by four
synthetic, idempotent support-ticket writes. The write sample intentionally
stays below the endpoint's five-per-hour IP limit and creates local emulator
data only:

```powershell
npm run test:emu
npm run load:test:emu
```

`npm audit` is run in both the frontend and backend roots. CI fails for
high-severity or critical findings; moderate transitive development-tool
advisories are listed in the Phase 12 report and should be rechecked as
upstream packages release fixes. Never use `npm audit fix --force` without
reviewing changes to supported Node versions and major APIs.

Cloud Run deployment, secrets, probes, monitoring, alerts, scheduled Firestore
exports, restore, rollback, and credential-rotation procedures are documented
in [`RUNBOOK.md`](./RUNBOOK.md). The multi-stage non-root API image is built
from [`Dockerfile`](./Dockerfile), and its starting Cloud Run service
configuration is [`deploy/cloudrun.service.yaml`](./deploy/cloudrun.service.yaml).
The security architecture, OWASP mapping, endpoint/schema/test inventory, and
known limitations are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).
