# On-device vocabulary store — Plan Brief

> Full plan: `context/changes/seed-vocabulary-and-local-storage/plan.md`

## What & Why

`Eloquence Flashcards` needs a place to keep its vocabulary deck and each word's known/unknown state — entirely on-device, per the PRD's no-backend requirement. This is roadmap item `F-01`: the one foundation that unlocks `S-01`, the app's north-star flow (tailored flashcard loop). Without it, `S-01` has nothing to rank against and nowhere to persist a user's progress.

## Starting Point

The repo is the unmodified Expo Router scaffold from `/10x-bootstrapper` — default template screens only, no persistence library, no vocabulary data anywhere, no test runner configured.

## Desired End State

A curated ~70-word vocabulary dataset (word, definition, category) ships in the app, with `getSeedVocabulary()`, `getKnownState()`, and `setWordKnownState()` available as a stable, AsyncStorage-backed data contract. A throwaway debug screen proves the whole thing works, including surviving a full app restart.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Storage mechanism | AsyncStorage | Zero native config, works in Expo Go, more than enough for a ~70-entry dataset. |
| Word data shape | word + definition + single category enum | Simpler to curate under a 2-day deadline than a tags array or an added difficulty score. |
| Seed data source | Claude curates ~70 words now | Unblocks today with zero external dependency; user does a quick quality skim. |
| Known-state lifecycle | Deprioritized, never deleted/reset | Matches PRD's "cards adapt over time" without adding a reset feature nothing requires. |
| Verification method | Throwaway debug screen, no test runner | AGENTS.md confirms no test runner exists yet; setting one up isn't worth the time against the deadline for a foundation this small. |
| F-01/S-01 boundary | F-01 = data access only, no matching logic | Matches the roadmap's Foundation Scope Cap exactly. |

## Scope

**In scope:**
- Vocabulary types + curated seed dataset (`src/constants/vocabulary.ts`)
- AsyncStorage-backed read/write functions (`src/lib/vocabulary-store.ts`)
- Throwaway debug screen (`src/app/debug-vocabulary.tsx`) for manual verification

**Out of scope:**
- Matching/ranking algorithm (S-01)
- Manual "add flashcard" UI (FR-004, Parked)
- Any test runner setup
- Permanent navigation entry for the debug screen

## Architecture / Approach

A static TS module holds the seed data; a small data-access module wraps AsyncStorage with a read-merge-write contract for known/unknown state (one JSON blob, not one key per word). A throwaway route renders and exercises both, standing in for automated tests until `S-01`'s real UI exists.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Vocabulary data module | Seed dataset + AsyncStorage read/write functions | Word/category curation quality — needs a quick human skim |
| 2. Debug verification screen | Manual end-to-end proof, incl. restart-persistence | None significant — throwaway, scope-capped |

**Prerequisites:** None — this is the first change in the roadmap.
**Estimated effort:** Not time-boxed here (roadmap avoids estimates) — both phases are small; the dominant cost is curating ~70 words, not the code.

## Open Risks & Assumptions

- The curated word list is LLM-authored, not domain-vetted — worth a quick skim before treating it as final content.
- AsyncStorage is unencrypted; acceptable here since vocabulary/known-state data isn't sensitive (the PRD's "no data leaves device" concern is about network transmission, which AsyncStorage trivially satisfies by being local-only).

## Success Criteria (Summary)

- `getSeedVocabulary()`, `getKnownState()`, `setWordKnownState()` exist and type-check cleanly.
- The debug screen shows all ~70 words with correct known/unknown state, and that state survives a full app restart.
- `S-01`'s planning can start without needing to touch storage internals.
