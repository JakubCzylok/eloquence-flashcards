# Email/password auth with per-user cloud data (Supabase) — Plan Brief

> Full plan: `context/changes/auth/plan.md`

## What & Why

The 10xBuilder authentication requirement is "a user who logs in and sees
resources assigned to them". The app currently has no auth — it's single-user,
on-device. This change adds Supabase Auth (email + password), puts the whole app
behind a login gate, and moves `known_state` + `user_words` to per-user Postgres
tables with row-level security, so every user sees only their own data.

## Starting Point

S-03 shipped a clean CRUD store (`vocabulary-store.ts`, `user-vocabulary.ts`)
with narrow signatures, typed error classes, and a UI error banner, all over
AsyncStorage. `src/app/index.tsx` is the only real screen; `src/app/_layout.tsx`
is the single mount point. Tests: jest with an AsyncStorage mock; Playwright e2e
against a static web export. No backend, no `@supabase/supabase-js`, no `.env`.

## Desired End State

No session → a login screen (email + password, sign-up toggle). Signed in → the
normal ranking loop. `known_state` and `user_words` live in Supabase under the
user's `user_id`; a second account on the same device sees its own empty data.
The ranking loop works offline after a prior online load (local read cache);
marking a word / editing a card is online-only and shows an offline message
rather than faking success. The typed person-description still never leaves the
device. First sign-in on a device with pre-auth data uploads it to the account
once.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Data model | Hybrid: known-state + cards in Supabase per user; description stays in-memory | Meets the auth requirement without breaking the description-privacy NFR (Risk #7) | change.md |
| Offline | Read cache + online-only writes | Simple, testable, no sync engine; loop still usable offline after login | Q |
| Pre-auth local data | Adopt on first sign-in, once per device (flag `vocabulary-local-migrated`) | No one loses on-device progress; pre-auth data belongs to whoever signs in first | Q |
| App gating | Whole app behind login | Literally satisfies "access tied to a user who logs in"; one data model | Q |
| Email confirmation | OFF (Supabase project setting) | Sign-up → login is instant and e2e-testable; acceptable for MVP | Q |
| Auth method | Email + password only | Simplest to build and test; no deep-link / OAuth setup | change.md |
| Session storage | `expo-secure-store` native, AsyncStorage web | Standard Supabase + Expo pattern | Plan |
| Store signatures | Unchanged | Swap happens inside the lib modules; `index.tsx` barely changes | Plan |

## Scope

**In scope:** Supabase client + auth context + login screen + gate; `known_state`
& `user_words` tables with RLS; store modules repointed at Supabase with a local
read cache; one-time first-login migration of on-device data; foundation-doc
updates (PRD, roadmap, tech-stack, infrastructure, test-plan); a per-user-data
e2e test; existing e2e specs updated to run behind a signed-in test session.

**Out of scope:** offline write queue / real-time sync; magic-link / OAuth /
password reset / email change; email-confirmation flow; RLS testing in CI beyond
mocked-client unit tests + one live e2e; any change to `rankVocabulary` / `slug`
/ the phase machine.

## Architecture / Approach

`src/lib/supabase.ts` builds one client (platform storage adapter, no URL
session detection). `src/lib/auth-context.tsx` wraps `_layout.tsx`, exposes
`useAuth()`, and runs the first-login migration on the sign-in transition. A gate
in `_layout.tsx` renders `LoginScreen` or the existing `AppTabs`. The store
modules (`vocabulary-store.ts`, `user-vocabulary.ts`) keep their signatures but
now: read from Supabase for `auth.uid()` → write the result to the existing
AsyncStorage key as cache → fall back to that cache on a network/auth error;
writes require a session, upsert one row, then refresh the cache, and throw on
failure (the UI banner already handles that).

## Phases at a Glance

| Phase | Delivers | Key risk |
| --- | --- | --- |
| 1. Client + auth context + gate | Login/sign-up/sign-out gating the whole app; data still local | Session storage adapter across web/native; gate placement outside the tab navigator |
| 2. Stores → Supabase + cache | `known_state` / `user_words` per-user in Postgres with RLS; local read cache; online-only writes | Cache read/write ordering; rewriting the store unit tests against a mock client; RLS policy correctness |
| 3. First-login migration | One-time upload of pre-auth on-device data | Idempotency; not blocking the app if it fails |
| 4. Docs + risks + e2e | PRD/roadmap/tech-stack/infra/test-plan aligned; R8/R9 added; per-user e2e; existing e2e behind a test login | Existing e2e specs now need a signed-in session (storageState/setup project) |

**Prerequisites:** a Supabase project; `.env` with `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY`; `supabase/schema.sql` applied in the SQL editor;
"Confirm email" turned OFF.
**Estimated effort:** ~3–4 focused sessions across 4 phases.

## Open Risks & Assumptions

- Assumes the user creates the Supabase project and applies the SQL before
  Phase 2 manual verification; Phases 1–3 code can be written before that but not
  fully verified.
- RLS is the only cross-user boundary — a wrong `using` / `with check` clause
  silently leaks data. Covered by manual check + the Phase 4 e2e, not by CI.
- Existing e2e specs need reworking to authenticate; if a `storageState` setup
  project is fiddly on the static-export target, this could cost more than
  estimated.
- "Confirm email OFF" is a project setting, not code — must be documented so a
  fresh project reproduction works.

## Success Criteria (Summary)

- Cold start with no session shows a login screen; sign-up lands in the loop;
  sign-out returns to login.
- A card added by one account is invisible to another account and survives an app
  restart (it's in Supabase); Supabase rows carry the right `user_id`.
- Offline after login: the ranking loop still renders from cache; writes show an
  offline message instead of silently failing.
- `npx tsc --noEmit`, `npm run lint`, `npm test` pass; `npm run e2e` passes with
  Supabase env set (skips the auth spec cleanly without it).
