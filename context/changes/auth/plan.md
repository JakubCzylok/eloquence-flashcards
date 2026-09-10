# Email/password auth with per-user cloud data (Supabase) — Implementation Plan

## Overview

Add Supabase Auth (email + password) and put the whole app behind a login gate,
so access is tied to a signed-in user. Move `known_state` and `user_words` from
on-device AsyncStorage to Supabase Postgres tables keyed by `user_id` and
protected by row-level security, with a local read cache so the ranking loop
still works offline after login. The typed person-description stays in React
state only — it never reaches storage or the network (PRD NFR / test-plan Risk
#7 preserved). Satisfies the 10xBuilder authentication requirement ("a user who
logs in and sees resources assigned to them"), which the current single-user
on-device model does not meet.

## Current State Analysis

- **`src/lib/vocabulary-store.ts`** — `getSeedVocabulary()` (sync),
  `getKnownState(): Promise<Record<string, boolean>>` and
  `setWordKnownState(id, known): Promise<void>` over AsyncStorage key
  `vocabulary-known-state`, read-merge-write serialized through a module-private
  `writeQueue`. `getKnownState` propagates `KnownStateReadError` on a
  storage/parse/shape failure (returns `{}` only for an absent key).
  `getAllVocabulary()` = seed ++ `getUserWords()`.
- **`src/lib/user-vocabulary.ts`** — `getUserWords()`, `slug()`, `addUserWord()`,
  `updateUserWord()`, `deleteUserWord()` over AsyncStorage key
  `vocabulary-user-words`; own `writeQueue`; `UserWordsReadError` on a bad read;
  id = `user-<slug(word)>`; collision checked against seed ids + existing user
  ids.
- **`src/app/index.tsx`** — the only real screen. `phase: 'input' | 'card' |
  'done' | 'manage'`. Mount effect runs `reloadStores()` (a `useCallback`) which
  calls `getKnownState()` and `refreshDeck()` (`getAllVocabulary()`), each with a
  `.catch` that sets a `storeError` banner. `handleSubmit` calls
  `rankVocabulary(trimmed, knownState, deck)`. `handleMark` awaits
  `setWordKnownState`, surfaces failures, skips the optimistic update on error.
  Manage handlers (`handleAddCard`/`handleUpdateCard`/`handleDeleteCard`) call
  the `user-vocabulary` CRUD then `refreshDeck()`.
- **`src/app/_layout.tsx`** — `ThemeProvider` → `<AnimatedSplashOverlay />` →
  `<AppTabs />`. `AppTabs` is `app-tabs.web.tsx` (an `absolute`-positioned web
  tab bar) / `app-tabs.tsx` (`NativeTabs`).
- **Test infra** — `jest-expo`; `jest.setup.js` (registered via
  `setupFilesAfterEnv`) swaps AsyncStorage for the in-memory mock; unit tests in
  `src/lib/*.test.ts` import `@jest/globals`. E2E: Playwright against a static
  `expo export --platform web` served on `:8081` (`playwright.config.ts`
  `webServer` = export + `python3 -m http.server`); specs in `e2e/`, seed
  conventions in `e2e/e2e-rules.md` (role locators, `pressSequentially` for RN
  Web inputs, `afterEach` `localStorage.clear()`).
- **No `@supabase/supabase-js`, no `expo-secure-store`, no `.env`.** `.gitignore`
  ignores `.env*.local` but not a plain `.env`.
- **Foundation docs**: `prd.md` Access Control = *"Single user; no auth; data
  lives on-device only"*; NFR = *"The app remains fully usable with no network
  connection"* and *"No description of a person entered by the user leaves the
  device"*. `roadmap.md` Open Question #1 = cloud sync, unresolved.
  `tech-stack.md` has no backend. `test-plan.md` risks R1–R7; R7 is the
  description-privacy risk.

## Desired End State

Launching the app with no session shows a login screen (email + password, with a
sign-up toggle). After signing up or in, the user reaches the normal ranking
loop. `known_state` and `user_words` now live in Supabase under their `user_id`;
a second account on the same device sees its own (empty) data. Marking a word and
adding/editing/deleting a card write to Supabase; with no network those actions
show a "you're offline" message and do not lie about success. The ranking loop
itself works offline after a prior online load, from the local cache. Signing out
returns to the login screen. On the first sign-in on a device that already had
on-device data, that data is pushed into the account once.

Verify:
- `npx tsc --noEmit`, `npm run lint`, `npm test` pass.
- Manual: sign up → land in the loop; add a card → sign out → sign in → card
  still there; create a second account → its deck is just the seed; kill network
  → loop still renders, marking shows the offline message.
- `e2e/auth-per-user-data.spec.ts` passes against a live project with email
  confirmation off.

### Key Discoveries:

- `getKnownState` / `setWordKnownState` / the `user-vocabulary` CRUD already have
  narrow, well-tested signatures and their own error types + UI banner. Keeping
  those signatures lets `index.tsx` stay almost unchanged — the swap is inside
  the lib modules.
- The existing AsyncStorage keys (`vocabulary-known-state`,
  `vocabulary-user-words`) are the natural **read cache** after the swap: every
  successful remote read overwrites them; a failed remote read falls back to
  them.
- `user_words.id` stays `user-<slug>` but the table's primary key is
  `(user_id, id)`, so two users can each own `user-gravitas`. The seed-collision
  check in `addUserWord` is unchanged (it compares the bare slug to
  `SEED_VOCABULARY` ids, which are global).
- `_layout.tsx` is the single mount point — wrapping it in an `AuthProvider` and
  a gate component covers every route (there are only `index` and the leftover
  `explore`).
- Supabase's JS client needs a React Native storage adapter for the session;
  `expo-secure-store` on native, `AsyncStorage` on web (SecureStore is unavailable
  on web). `detectSessionInUrl: false` for RN.

## What We're NOT Doing

- **No offline write queue / sync engine.** Writes are online-only; offline
  writes fail with a message. (Chosen: "read cache + online writes".)
- **No `EXPO_PUBLIC_`-independent secret handling.** The anon key is public by
  design; `.env` is git-ignored for tidiness, not secrecy.
- **No magic-link / OAuth / password reset / email change.** Email + password
  sign-up and sign-in only. Password reset is a follow-up.
- **No email confirmation flow.** The Supabase project is configured with
  "Confirm email" OFF for the MVP; there is no "check your inbox" screen or deep
  link.
- **No migration of the leftover `explore` route or template chrome.**
- **No RLS testing in CI** beyond unit tests with a mocked client — the
  cross-user isolation check is a manual + single live e2e assertion.
- **No change to `rankVocabulary`, `slug`, the ranking tests, or the phase
  machine's shape.** `deck` and `knownState` still arrive as plain values.
- **No multi-device real-time sync.** Data is per-user and consistent on next
  load; no subscriptions.

## Critical Implementation Details

**Session storage adapter.** The Supabase client must be given a storage object
with `getItem`/`setItem`/`removeItem`. Use `expo-secure-store` when
`Platform.OS !== 'web'`, else `@react-native-async-storage/async-storage`.
SecureStore values are size-limited (~2KB) which is fine for a session token.
Create the client once at module scope in `src/lib/supabase.ts`; never in a
component body.

**Cache read/write ordering.** A store read does: `try remote → on success,
write the result to the AsyncStorage cache key and return it → on network/auth
error, read the cache key and return it (still `{}`/`[]` if the cache is also
empty) → on a *parse/shape* error of a remote row, throw` (that is a real bug,
not an offline condition). A store write does: `require a session → write remote
→ on success, update the cache key → on failure, throw` (the caller already
surfaces this). Never write the cache without a successful remote round-trip.

**First-login migration is once-per-device.** Gate it on a single AsyncStorage
flag `vocabulary-local-migrated`. On `onAuthStateChange` with a new session, if
the flag is absent: read the *current* contents of the two legacy keys, and if
either is non-empty upsert them into the signed-in user's rows (`known_state`
rows from the map, `user_words` rows as-is), then set the flag. After this runs
once, the legacy keys are only ever the cache. Rationale: the pre-auth data
originated from the single on-device user, so "it belongs to whoever signs in
first on this device" is the correct MVP semantics.

## Phase 1: Supabase client + auth context + login gate

### Overview

Stand up the Supabase client, an auth context, and a login screen that gates the
whole app. Data still lives on-device after this phase — only access changes.

### Changes Required:

#### 1. Dependencies + env

**File**: `package.json`, `.env` (new, git-ignored), `.gitignore`, `app.json`

**Intent**: Add the Supabase and secure-store packages; declare the env vars.

**Contract**: `npx expo install @supabase/supabase-js expo-secure-store`. Add
`.env` to `.gitignore`. `.env` holds `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (values supplied by the user). No `app.json`
change needed unless a scheme is missing (it already has `scheme:
"eloquenceflashcards"`).

#### 2. Supabase client

**File**: `src/lib/supabase.ts` (new)

**Intent**: One shared, correctly-configured client for the app and the lib
modules.

**Contract**: Export `supabase` (a `SupabaseClient`) built from the two env vars
with `auth: { storage: <platform adapter>, autoRefreshToken: true,
persistSession: true, detectSessionInUrl: false }`. Export a small
`currentUserId(): Promise<string | null>` helper. If either env var is missing,
throw a clear error at import time naming the `.env` keys.

#### 3. Auth context

**File**: `src/lib/auth-context.tsx` (new)

**Intent**: Expose session state and auth actions to the tree; keep components
out of the Supabase API.

**Contract**: `AuthProvider` (subscribes to `supabase.auth.onAuthStateChange`,
seeds from `supabase.auth.getSession()`) and `useAuth()` returning
`{ session, user, loading, signUp(email, pw), signIn(email, pw), signOut() }`.
`signUp`/`signIn` return `{ ok: true } | { ok: false; message: string }`
(map Supabase `AuthError` to a short message). `loading` is true until the
initial `getSession()` resolves.

#### 4. Login screen + gate

**File**: `src/components/login-screen.tsx` (new), `src/app/_layout.tsx`

**Intent**: Render login when logged out, the app when logged in.

**Contract**: `LoginScreen` — email + password `ThemedTextInput`s
(`accessibilityLabel` "Email" / "Password"), a primary button whose label
toggles "Sign in" / "Create account", a small link to switch mode, inline error
text (`accessibilityRole="alert"`), disabled/busy state during the request.
Follows repo component conventions. `_layout.tsx` wraps its subtree in
`<AuthProvider>` and renders: `loading` → a minimal splash/blank; no session →
`<LoginScreen />`; session → the existing `<AppTabs />`. The gate sits *outside*
`AppTabs` so the login screen has no tab bar.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Tests pass: `npm test`
- `src/lib/auth-context.test.tsx` (new) covers: provider starts `loading`, moves
  to no-session; `signIn` failure surfaces `{ ok: false, message }` (mocked
  `supabase.auth`).

#### Manual Verification:

- Cold start with no session shows the login screen, no tab bar.
- "Create account" with a fresh email lands directly in the ranking loop (email
  confirmation is off).
- Sign out returns to the login screen.
- Wrong password shows an inline error, no crash.

**Implementation Note**: After automated verification passes, pause for manual
confirmation before Phase 2.

---

## Phase 2: Move known_state + user_words to Supabase with read cache

### Overview

Repoint the two lib modules at Supabase tables scoped to `auth.uid()`, keeping
their public signatures. Reads cache to the existing AsyncStorage keys; writes
are online-only and throw on failure (the UI already surfaces that).

### Changes Required:

#### 1. Database schema + RLS

**File**: `supabase/schema.sql` (new — the user pastes it into the Supabase SQL
editor)

**Intent**: Two per-user tables with RLS so a user can only touch their own rows.

**Contract**: `known_state(user_id uuid references auth.users on delete cascade,
word_id text, known boolean not null, updated_at timestamptz default now(),
primary key (user_id, word_id))`. `user_words(user_id uuid references auth.users
on delete cascade, id text, word text not null, definition text not null,
category text not null, created_at timestamptz default now(), primary key
(user_id, id))`. Both: `enable row level security` + one `for all` policy
`using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

#### 2. known-state store → Supabase + cache

**File**: `src/lib/vocabulary-store.ts`

**Intent**: `getKnownState` / `setWordKnownState` operate on the `known_state`
table for the current user, with a local read cache.

**Contract**: Signatures unchanged. `getKnownState()`: select `word_id, known`
for the session user → build the map → write it to the
`vocabulary-known-state` cache key → return it. On a network/auth error, return
the cache key's parsed value (still `{}` if empty). Keep `KnownStateReadError`
for a genuinely malformed cache value. `setWordKnownState(id, known)`: require a
session (throw a typed `NotAuthenticatedError` if none), `upsert` one row
`(user_id, word_id, known)`, then update the cache key. Drop the `writeQueue`
(the DB upsert is atomic per row) or keep it — implementer's call; a single-row
upsert has no read-merge-write race. `getSeedVocabulary` and `getAllVocabulary`
unchanged in shape.

#### 3. user-words store → Supabase + cache

**File**: `src/lib/user-vocabulary.ts`

**Intent**: The CRUD operates on `user_words` for the current user, with a local
read cache.

**Contract**: Signatures unchanged (`getUserWords`, `slug`, `addUserWord`,
`updateUserWord`, `deleteUserWord`). `getUserWords()`: select the user's rows →
cache to `vocabulary-user-words` → return; fall back to cache on
network/auth error; `UserWordsReadError` only for a malformed cache value.
`addUserWord`: unchanged validation (trim, empty, slug-to-empty, seed-slug
collision); duplicate check now = "a `user_words` row with this `id` for this
user" (select or rely on the PK conflict); `insert` the row; update cache;
return the same `{ ok, ... }` shape; throw `NotAuthenticatedError` with no
session. `updateUserWord` / `deleteUserWord`: same shape, operate by
`(user_id, id)`; update cache.

#### 4. Auth-aware error type + client mock

**File**: `src/lib/supabase.ts` (or a small `src/lib/errors.ts`),
`src/lib/__mocks__/supabase.ts` (new) or `jest.mock` in the test files

**Intent**: A shared `NotAuthenticatedError`; a mock client for unit tests.

**Contract**: `NotAuthenticatedError extends Error`. Test mock exposes an
in-memory `known_state` / `user_words` keyed by a settable "current user" and a
toggle to simulate network failure, enough to drive the cache-fallback and
CRUD tests.

#### 5. Screen wiring (minimal)

**File**: `src/app/index.tsx`

**Intent**: Refresh stores when the session becomes available; clear cache view
on sign-out.

**Contract**: The mount `reloadStores()` already runs on mount; add `useAuth()`
`session?.user?.id` to its dependency list so it re-runs when the user changes.
No other logic change — the `.catch` banners already handle the offline/error
messages; add the offline message string for `NotAuthenticatedError` if it can
surface.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit`, `npm run lint`, `npm test` pass.
- `src/lib/vocabulary-store.test.ts` (extended): with the mock client — a remote
  read populates the cache; a simulated network failure returns the cache;
  `setWordKnownState` upserts and updates the cache; no session → throws
  `NotAuthenticatedError`.
- `src/lib/user-vocabulary.test.ts` (rewritten for the client): CRUD against the
  mock, duplicate rejection by `(user_id, id)`, cache fallback, `slug` unchanged,
  no-session throw.
- `src/lib/vocabulary-store.test.ts` `getAllVocabulary` still returns seed ++
  user rows.

#### Manual Verification:

- Add a card while signed in → appears; refresh the app → still there (came from
  Supabase, cache reseeded).
- Sign in as a second account → seed-only deck, no cards from the first account.
- In the Supabase table editor, confirm rows carry the right `user_id`.
- Disable network → the loop still renders from cache; marking a word shows the
  offline message and the mark does not appear to stick.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: First-login local-data adoption

### Overview

Once, per device, on the first sign-in, push any pre-existing on-device
known-state and user cards into the signed-in account.

### Changes Required:

#### 1. Migration module

**File**: `src/lib/local-migration.ts` (new)

**Intent**: Move legacy on-device data into the account exactly once.

**Contract**: `migrateLocalDataIfNeeded(userId: string): Promise<void>`. If
AsyncStorage flag `vocabulary-local-migrated` is set, return. Otherwise read the
raw legacy keys `vocabulary-known-state` and `vocabulary-user-words` directly
(not via the now-remote store functions); if either parses to a non-empty
map/array, `upsert` those rows for `userId` (`known_state` from the map entries,
`user_words` rows verbatim; on id conflict keep the existing account row). Set
the flag. Any failure: leave the flag unset (so it retries next sign-in) and
rethrow so the caller can log it — but do not block the app.

#### 2. Run it from the auth context

**File**: `src/lib/auth-context.tsx`

**Intent**: Trigger the migration on the sign-in transition.

**Contract**: In the `onAuthStateChange` handler, when a session appears
(`SIGNED_IN` / initial session), call `migrateLocalDataIfNeeded(user.id)` and
`await` it before flipping `loading` to false on that path (so the first store
read sees the migrated rows). Swallow-and-log its rejection — never leave the
user stuck on a spinner.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit`, `npm run lint`, `npm test` pass.
- `src/lib/local-migration.test.ts` (new): seeds the legacy keys in the mock,
  runs `migrateLocalDataIfNeeded`, asserts the mock client received the upserts
  and the flag is set; a second call is a no-op; a client failure leaves the
  flag unset and rethrows.

#### Manual Verification:

- On a build with pre-existing local cards (from before auth), sign in for the
  first time → those cards and known-state appear on the account (check the
  Supabase table editor).
- Sign out and back in → no duplicate upload, data intact.

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Foundation docs + test-plan risks + e2e

### Overview

Bring the foundation contracts in line with the new model and add the
cross-user-isolation coverage.

### Changes Required:

#### 1. PRD

**File**: `context/foundation/prd.md`

**Intent**: Reflect accounts + RLS and the relaxed offline NFR.

**Contract**: *Access Control* section → accounts via Supabase Auth
(email/password), every resource scoped to `user_id`, RLS-enforced; still no
roles / multi-profile. NFR *"remains fully usable with no network connection"* →
*"the ranking loop is usable offline after a prior online load, from a local
cache; login and data writes require connectivity"*. Keep the NFR *"No
description … leaves the device"* verbatim and add one line that the description
remains in-memory only under the new model. *Open Questions* #1 (cloud sync) →
note it is partially resolved by this change (per-user cloud storage; real-time
multi-device sync still out of scope). Add a one-line pointer to
`context/changes/auth/`.

#### 2. Roadmap

**File**: `context/foundation/roadmap.md`

**Intent**: Record that auth / per-user data landed.

**Contract**: Add an entry (e.g. `F-02: auth-and-per-user-data`) to the
appropriate table(s) with status `done` on completion, and move the "cloud sync"
Parked/Open item to reflect the partial resolution.

#### 3. Tech stack

**File**: `context/foundation/tech-stack.md`

**Intent**: Add the backend.

**Contract**: Add Supabase (Auth + Postgres + RLS), `@supabase/supabase-js`,
`expo-secure-store`; note env vars `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY`; note "Confirm email" is disabled for the MVP.

#### 4. Infrastructure

**File**: `context/foundation/infrastructure.md`

**Intent**: Record the managed backend dependency.

**Contract**: One subsection: Supabase project as the managed
auth + database backend; the anon key ships in the client by design; RLS is the
security boundary; schema lives at `supabase/schema.sql`.

#### 5. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Add the auth-shaped risks.

**Contract**: Add to §2: **R8** — "a logged-out or expired-session user reaches
another user's known-state or cards" (impact High, likelihood Medium; source:
this change). **R9** — "a query or a missing/blocked RLS policy returns rows
across `user_id`" (impact High, likelihood Low-Medium; source: this change).
Add matching rows to §3 rollout (covered by the Phase 4 e2e + the Phase 2 unit
tests) and a §6 cookbook note on writing an auth-scoped test.

#### 6. E2E — per-user data isolation

**File**: `e2e/auth-per-user-data.spec.ts` (new), `e2e/e2e-rules.md` (note),
`playwright.config.ts` (env pass-through)

**Intent**: Prove login + per-user persistence end to end.

**Contract**: Requires `EXPO_PUBLIC_SUPABASE_*` present at export time and email
confirmation off. One test: sign up as `crud+<Date.now()>@example.test` → add a
card → sign out → sign in again → the card is still listed; (optional second
account) sign up a fresh email → its manage list is empty. `afterEach` signs out
and clears `localStorage`. Role-based locators per `e2e-rules.md`;
`pressSequentially` for the RN Web inputs. If the env vars are absent, the spec
`test.skip()`s with a clear message (so the suite still runs locally without a
project).

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit`, `npm run lint`, `npm test` pass.
- `npm run e2e` passes with the Supabase env vars set (or skips
  `auth-per-user-data.spec.ts` with a message when they are absent), and the
  existing `seed` / `loop-gibberish` / `custom-flashcards-crud` specs still pass
  (they now run behind a signed-in test session — see the note below).

#### Manual Verification:

- Read back `prd.md` / `tech-stack.md` / `test-plan.md` — the new model is
  described, no stale "no auth" / "fully offline" wording remains.
- The `auth-per-user-data` e2e passes against the real project.

**Implementation Note**: Final phase — pause for manual confirmation, then the
epilogue.

## Testing Strategy

### Unit Tests:

- `auth-context.test.tsx` — loading → no-session; sign-in error mapping (mock
  `supabase.auth`).
- `vocabulary-store.test.ts` / `user-vocabulary.test.ts` — rewritten against a
  mock Supabase client: remote read seeds cache; network failure falls back to
  cache; writes upsert + refresh cache; no session → `NotAuthenticatedError`;
  `getAllVocabulary` = seed ++ user rows; `slug` and validation unchanged.
- `local-migration.test.ts` — one-shot upload, idempotency, failure leaves the
  flag unset.

### Integration / E2E:

- `auth-per-user-data.spec.ts` (new) — sign up → add card → sign out → sign in →
  card persists; fresh account → empty deck. Live project required; skips
  cleanly without env.
- Existing e2e specs (`seed`, `loop-gibberish`, `custom-flashcards-crud`) get a
  shared `test.beforeEach` (or a fixture / `storageState`) that signs a
  throwaway test user in, since the app is now gated. Prefer a Playwright
  `storageState` produced once by a `setup` project over logging in per test.

### Manual Testing Steps:

1. Fresh project, `.env` set, "Confirm email" OFF, `supabase/schema.sql` applied.
2. Cold start → login screen. Create account → ranking loop.
3. Manage → add "gravitas" / academic. Refresh app → still there. Check the
   `user_words` table: one row, correct `user_id`.
4. Sign out → login screen. Create a second account → manage list empty.
5. Sign back in as the first account → "gravitas" still there.
6. DevTools offline → loop still renders a card; mark a word → offline message,
   mark does not stick; card list still shows from cache.
7. On a device/build that had pre-auth local data: first sign-in → that data
   appears on the account; sign out/in → no duplication.

## Performance Considerations

Per-user row counts are tiny (≤ ~100 known-state rows, tens of user cards). One
`select` per store read on session change; single-row upserts on write. The
read cache means the loop's first paint does not wait on the network after the
initial load. No pagination, no indexes beyond the primary keys needed.

## Migration Notes

- **DB**: `supabase/schema.sql` is applied by hand in the Supabase SQL editor
  (no migration tool in the project). Re-running it should be guarded with
  `create table if not exists` / `drop policy if exists` … `create policy`.
- **On-device → account**: handled by Phase 3, once per device, gated by
  `vocabulary-local-migrated`. The legacy AsyncStorage keys are then reused as
  the read cache — not deleted.
- **Rollback**: revert the commits; the legacy on-device code path returns. Rows
  already in Supabase are orphaned but harmless. No destructive local step (the
  migration reads the legacy keys, it never clears them).

## References

- Change identity + decisions: `context/changes/auth/change.md`
- CRUD store this builds on: `context/changes/custom-flashcards/plan.md`
  (`dffa39a`, `11e3763`)
- Pattern references: `src/lib/vocabulary-store.ts` (error types + banner
  contract), `src/lib/user-vocabulary.ts` (result-shape CRUD),
  `src/app/_layout.tsx` (single mount point), `e2e/seed.spec.ts` +
  `e2e/e2e-rules.md` (RN Web e2e conventions), `jest.setup.js` (mock wiring)
- PRD / roadmap / tech-stack / test-plan under `context/foundation/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Supabase client + auth context + login gate

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit` — cd651f7
- [x] 1.2 Linting passes: `npm run lint` — cd651f7
- [x] 1.3 Tests pass: `npm test` — cd651f7
- [x] 1.4 `auth-context.test.tsx` covers loading→no-session and a mapped sign-in failure — cd651f7

#### Manual

- [x] 1.5 Cold start with no session shows the login screen (no tab bar) — verified via headless smoke against the live project — cd651f7
- [x] 1.6 "Create account" with a fresh email lands in the ranking loop — verified via headless smoke (after enabling signups + email autoconfirm) — cd651f7
- [x] 1.7 Sign out returns to the login screen — verified via headless smoke — cd651f7
- [x] 1.8 Wrong password shows an inline error, no crash — verified via headless smoke — cd651f7

### Phase 2: Move known_state + user_words to Supabase with read cache

#### Automated

- [x] 2.1 Type checking passes: `npx tsc --noEmit` — 8361b0d
- [x] 2.2 Linting passes: `npm run lint` — 8361b0d
- [x] 2.3 Tests pass: `npm test` — 8361b0d
- [x] 2.4 `vocabulary-store.test.ts` covers remote-read→cache, network-failure→cache, upsert→cache, no-session throw — 8361b0d
- [x] 2.5 `user-vocabulary.test.ts` covers CRUD vs mock client, duplicate by (user_id,id), cache fallback, no-session throw — 8361b0d
- [x] 2.6 `getAllVocabulary` still returns seed ++ user rows — 8361b0d

#### Manual

- [x] 2.7 Add a card while signed in, refresh the app, it persists (from Supabase) — 8361b0d
- [x] 2.8 A second account sees a seed-only deck — 8361b0d
- [x] 2.9 Supabase table rows carry the correct `user_id` — 8361b0d
- [x] 2.10 Offline: loop renders from cache; marking shows the offline message and does not stick — 8361b0d

### Phase 3: First-login local-data adoption

#### Automated

- [x] 3.1 Type checking passes: `npx tsc --noEmit` — 06c261f
- [x] 3.2 Linting passes: `npm run lint` — 06c261f
- [x] 3.3 Tests pass: `npm test` — 06c261f
- [x] 3.4 `local-migration.test.ts` covers one-shot upload, idempotent second call, failure leaves the flag unset — 06c261f

#### Manual

- [x] 3.5 First sign-in on a build with pre-auth local data uploads it to the account — 06c261f
- [x] 3.6 Sign out/in causes no duplicate upload; data intact — 06c261f

### Phase 4: Foundation docs + test-plan risks + e2e

#### Automated

- [x] 4.1 Type checking passes: `npx tsc --noEmit`
- [x] 4.2 Linting passes: `npm run lint`
- [x] 4.3 Tests pass: `npm test`
- [x] 4.4 `npm run e2e` passes with Supabase env set (or skips `auth-per-user-data.spec.ts` cleanly without it); existing specs still pass behind a signed-in test session

#### Manual

- [x] 4.5 `prd.md` / `tech-stack.md` / `test-plan.md` describe the new model; no stale "no auth" / "fully offline" wording
- [x] 4.6 `auth-per-user-data.spec.ts` passes against the real project
