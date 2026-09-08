# Adaptive card ranking — Plan Brief

> Full plan: `context/changes/adaptive-card-ranking/plan.md`

## What & Why

Roadmap slice `S-02`, covering the PRD's Secondary Success Criterion: "Cards adapt over
time — the app gets better at picking relevant words as the user marks more
known/unknown." `rankVocabulary()` already ranks the seed deck against a description and
sinks known words; this adds a persisted per-word count of how often each word has been
marked unknown vs known, so words the user keeps missing rise **within their relevance
tier**.

## Starting Point

S-01 (`tailored-flashcard-loop`) shipped: a pure, deterministic four-pass
`rankVocabulary(description, knownState)`; `getKnownState`/`setWordKnownState` over
AsyncStorage with a serialized write queue; a loop screen (`src/app/index.tsx`) that
loads known-state on mount, ranks on submit, and writes on each mark. `jest-expo` is
wired but no store code is unit-tested and no AsyncStorage mock exists.

## Desired End State

After several sessions, the loop leads with words the user repeatedly gets wrong — but
only among words that match the current description and are not already marked known, and
never ahead of a fresher, more description-relevant word. Known words stay sunk
regardless of past struggle. `rankVocabulary()` stays pure and deterministic. A separate
`vocabulary-mark-history` AsyncStorage key holds the counts; F-01's known-state storage
is untouched.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Signal shape | Counters `{ timesUnknown, timesKnown }` per word | Exact, no clock (keeps the ranker pure), gives a real magnitude, trivial to test |
| Weighting | Reorder *within* the not-known tiers only | Preserves S-01's relevance-first structure and the "ranked from the description" wedge |
| Scope | Global per-word | Description-independent "you find this hard"; per-category collapses to global with single-category seed data |
| Known interaction | Struggle never unsinks a known word | Consistent with "known sinks"; a word you now know shouldn't resurface |
| Record point | New `recordMark(id, known)` called from `handleMark` | Single existing async hook; respects the S-02/S-03 contract split (leaves `setWordKnownState` alone) |
| Decay / reset | None — counters only increment | Matches F-01's "deprioritized, never deleted"; `timesKnown` offsets the score naturally |
| Testing | Unit-test the weighted ranker + the history store; no UI tests | The weighting logic is the risk and it's pure; matches the repo's testing posture |

## Scope

**In scope:**
- `MarkHistory` type + `getMarkHistory()` / `recordMark()` in `src/lib/vocabulary-store.ts` (new key `vocabulary-mark-history`)
- AsyncStorage jest mock wired via `setupFiles` + `jest.setup.js`
- `rankVocabulary` optional 3rd `history` param + within-tier struggle sort
- `src/app/index.tsx`: load history on mount, pass to `rankVocabulary`, `recordMark` on each mark
- Unit tests: extended `vocabulary-ranking.test.ts`, new `vocabulary-store.test.ts`

**Out of scope:**
- Time decay / forgetting curves / counter caps / reset (S-04 territory)
- Cross-tier boost or a "most-struggled first" mode (breaks the wedge; S-04)
- Per-category / per-description scoping
- Any change to `getSeedVocabulary` / `getKnownState` / `setWordKnownState`
- Component / integration tests for `index.tsx`
- Migration (additive key)

## Architecture / Approach

`recordMark` accumulates counts under a new key, serialized on the same write queue as
known-state so the two never race. `rankVocabulary` gains an optional `history` argument
(default `{}`, so S-01's call site and tests are untouched); after each not-known
round-robin list is built it is re-sorted by `struggleScore = timesUnknown − timesKnown`
(descending, stable tie-break on pre-sort index — no `Date`/random). The known tiers are
never re-sorted, and the four passes concatenate in the same order, so struggle only ever
reshuffles within a relevance tier. Phase 1 is all of that plus tests; Phase 2 is the
~15-line screen wiring.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. History store + weighted ranker (pure, tested) | `MarkHistory`, `getMarkHistory`/`recordMark`, AsyncStorage jest mock, weighted `rankVocabulary`, unit tests | Getting the within-tier sort right (must not cross tiers or unsink known); first AsyncStorage mock in the repo |
| 2. Wire history into the loop screen | `index.tsx` loads history, passes it in, records marks | Small `index.tsx` overlap with the parallel S-03 branch — rebase once |

**Prerequisites:** S-01 merged. Parallel with S-03 (`custom-flashcards`) — S-02 merges first per the agreed order.
**Estimated effort:** ~1–2 focused sessions; Phase 1 is the bulk, Phase 2 is thin.

## Open Risks & Assumptions

- The official `@react-native-async-storage/async-storage/jest/async-storage-mock` path is
  assumed stable for the installed version — verify before wiring.
- Lifetime-cumulative counters could let one heavily-missed word dominate its tier
  forever; accepted for MVP (a saturation cap is a one-line follow-up).
- `index.tsx` is edited by both S-02 and S-03; the overlap is small (one extra arg + one
  extra `await`) and resolved by merging S-02 first.

## Success Criteria (Summary)

- A word marked "Don't know it" repeatedly (across restarts) leads its relevance tier on
  a matching description; a word marked "Know it" stays sunk regardless.
- The top card still visibly relates to the typed description.
- `npm test` (extended ranker tests + new store tests), `npx tsc --noEmit`, and
  `npm run lint` all pass.
