# Adaptive card ranking Implementation Plan

## Overview

Implement roadmap slice `S-02`. `rankVocabulary()` currently ranks the seed deck against
a description and sinks words the user has marked known. This change adds a second,
persisted signal: a per-word count of how often each word has been marked unknown vs
known across sessions. Words the user repeatedly misses ("struggle") rise **within their
relevance tier**; reliably-known words stay sunk. This satisfies the PRD's Secondary
Success Criterion ("Cards adapt over time — the app gets better at picking relevant words
as the user marks more known/unknown") without touching the "ranked from the description"
wedge.

## Current State Analysis

- **`src/lib/vocabulary-ranking.ts`** — `rankVocabulary(description, knownState): VocabularyWord[]`.
  Pure, deterministic. Builds four passes in order: (A) matched-category words not marked
  known, emitted round-robin across matched categories by score; (B) matched-category
  words marked known, same round-robin; (C) unmatched words not marked known, seed order;
  (D) unmatched words marked known, seed order. Ties break by `SEED_VOCABULARY` index.
  Result is always a permutation of the 72 seed words.
- **`src/lib/vocabulary-store.ts`** — `getSeedVocabulary()` (sync), `getKnownState()`
  (AsyncStorage key `vocabulary-known-state`, `{}` on absent/parse failure, never throws),
  `setWordKnownState(id, known)` (read-merge-write, serialized through a module-private
  `let writeQueue: Promise<void>` chain).
- **`src/app/index.tsx`** — the loop screen. State: `phase`, `description`, `queue`,
  `index`, `knownState`, `markingRef`. On mount a `useCallback`-wrapped `loadKnownState`
  runs `getKnownState().then(setKnownState)` from a `useEffect`. `handleSubmit` calls
  `setQueue(rankVocabulary(trimmed, knownState))`. `handleMark(known)` guards on
  `markingRef`, `await setWordKnownState(word.id, known)`, merges into local `knownState`,
  advances `index` or sets `phase: 'done'`.
- **Test infra** — `jest-expo` preset, `"jest"` config block in `package.json` with
  `moduleNameMapper` for `@/`. `src/lib/vocabulary-ranking.test.ts` covers the pure
  ranker (imports `SEED_VOCABULARY` directly, `@jest/globals`). **No AsyncStorage mock is
  wired** — no store code is unit-tested yet. `@react-native-async-storage/async-storage`
  ships an official jest mock at `@react-native-async-storage/async-storage/jest/async-storage-mock`.
- **No `context/foundation/lessons.md`.**
- **Parallel session (M2L5):** `S-03` (`custom-flashcards`) is being built concurrently.
  Contract split (recorded in both `change.md` files): S-02 owns the `rankVocabulary`
  signature change and adds only *new* functions to `vocabulary-store.ts`; it does not
  modify `getSeedVocabulary()` / `getKnownState()` / `setWordKnownState()`. S-03 adds a
  new `getAllVocabulary()` and leaves the ranker alone. Recommended merge order: S-02
  first, then S-03 rebases the small `src/app/index.tsx` overlap.

## Desired End State

A user who has been through several sessions sees the loop prioritise words they keep
getting wrong: on a new description, among the words that match that description and that
the user has **not** marked known, the ones with the highest net "missed" count appear
first. Words the user has marked known still never appear before not-known words,
regardless of past struggle. A word matched only weakly by the description still ranks
after every strongly-matched not-known word — struggle reorders *within* a relevance
tier, never across tiers. `rankVocabulary()` stays pure and deterministic. Nothing about
F-01's known-state storage changes; a separate `vocabulary-mark-history` key accumulates
the counts.

Verify: `npm test` covers the weighted reorder and the history store. Manually: mark a
word unknown several times across app restarts, then enter a description that matches its
category and confirm it now leads its tier; mark another word known and confirm it stays
at the bottom even after being marked unknown twice earlier.

### Key Discoveries:

- The four-pass structure in `rankVocabulary` (`src/lib/vocabulary-ranking.ts`) is the
  seam to extend: apply the struggle sort to the not-known lists (A and C) *after* the
  round-robin builds them, leaving B and D untouched.
- `rankVocabulary` has exactly one production call site (`src/app/index.tsx` `handleSubmit`)
  and one test file — a new optional third parameter with a default is fully
  backward-compatible.
- `setWordKnownState`'s `writeQueue` is module-private; a `recordMark` in the same file
  can reuse it so history writes and known-state writes never interleave on either key.
- `handleMark` already `await`s one storage write behind the `markingRef` guard — adding
  a second `await recordMark(...)` in the same block needs no new concurrency handling.
- JS `Array.prototype.sort` is stable in Hermes and modern V8, but S-01's ranker went out
  of its way to be provably deterministic — use an explicit decorate/sort/undecorate by
  `(struggleScore desc, originalIndex asc)` rather than relying on sort stability.

## What We're NOT Doing

- **No recency / time decay** — counters only ever increment; no `Date` in the ranking
  path. Time-based forgetting curves are S-04 (spaced repetition), parked.
- **No counter cap / reset** — consistent with F-01's "deprioritized, never deleted".
  (A small saturation cap is noted as a trivial follow-up if one word dominates in
  practice.)
- **No cross-tier boost** — a struggled word never out-ranks a fresher, more
  description-relevant word. The wedge ("ranked from the description") is preserved.
- **No "most-struggled lead-in"** — the first cards always relate to the description;
  a review-hard-words-first mode is a different feature (S-04).
- **No per-category or per-description scoping** — one global struggle score per word id.
  (Per-category collapses to global given single-category seed data; revisit if S-03's
  user words are multi-category.)
- **No change to `getSeedVocabulary()` / `getKnownState()` / `setWordKnownState()`** —
  additive only, per the S-03 contract split.
- **No component / integration tests for `index.tsx`** — the wiring is manual-verified,
  matching S-01's testing posture. Only the pure ranker and the history store are
  unit-tested.
- **No migration** — the new key is absent for existing users and reads as `{}`.

## Implementation Approach

Two phases. Phase 1 adds the persisted history (`getMarkHistory` / `recordMark` + type in
`vocabulary-store.ts`), wires the official AsyncStorage jest mock so store code can be
unit-tested for the first time, extends `rankVocabulary` with the optional `history`
parameter and the within-tier struggle sort, and covers both with unit tests — no UI
touched. Phase 2 is the thin screen wiring: load history on mount, pass it to
`rankVocabulary`, call `recordMark` on each mark, and manually confirm the loop actually
adapts across sessions.

## Critical Implementation Details

**Struggle sort is within-tier only.** After `roundRobin(matched, matchedNotKnown)`
produces the matched-not-known list and `unmatchedNotKnown` is collected, each of those
two arrays is re-sorted by `struggleScore` descending, ties by the element's index in the
array before the sort (decorate/sort/undecorate). The matched-known and unmatched-known
arrays are **not** re-sorted. The four passes are still concatenated in the same A→B→C→D
order, so no struggled word can appear before a less-struggled word that sits in an
earlier tier.

**`struggleScore(word) = (history[word.id]?.timesUnknown ?? 0) - (history[word.id]?.timesKnown ?? 0)`.**
A word never marked, or marked known at least as often as unknown, scores `≤ 0` and keeps
its round-robin / seed position among equal scores. Only `> 0` floats a word up.

**Shared write queue.** `recordMark` must be defined in `src/lib/vocabulary-store.ts` and
enqueue onto the same `writeQueue` variable `setWordKnownState` uses, so a rapid
known-mark + history-write pair cannot race even though they target different keys.

**Determinism preserved.** No `Math.random`, no `Date`. `rankVocabulary(d, k)` and
`rankVocabulary(d, k, {})` and `rankVocabulary(d, k, history)` are all pure functions of
their arguments; the result stays a permutation of `SEED_VOCABULARY`.

## Phase 1: History store + weighted ranker (pure, tested)

### Overview

Persisted per-word mark history, the AsyncStorage test mock, and the struggle-weighted
ranking — all with unit tests. No screen changes.

### Changes Required:

#### 1. Mark-history persistence

**File**: `src/lib/vocabulary-store.ts`

**Intent**: Add a second on-device store, alongside known-state, that counts how often
each word has been marked unknown vs known — the signal S-02's ranking consumes.

**Contract**: Add and export `type MarkHistory = Record<string, { timesUnknown: number; timesKnown: number }>`.
Add `getMarkHistory(): Promise<MarkHistory>` — reads AsyncStorage key
`vocabulary-mark-history`, JSON-parses, returns `{}` if unset or on parse failure, never
throws (mirror `getKnownState`). Add `recordMark(wordId: string, known: boolean): Promise<void>` —
read-merge-write that increments `timesKnown` when `known` is `true` else `timesUnknown`,
creating the `{ timesUnknown: 0, timesKnown: 0 }` entry if absent; it must enqueue onto
the existing module-private `writeQueue` (the same chain `setWordKnownState` uses), never
delete an entry. Do **not** modify `getSeedVocabulary` / `getKnownState` / `setWordKnownState`.

#### 2. AsyncStorage jest mock

**File**: `package.json` (jest config), `jest.setup.js` (new)

**Intent**: Let store code be unit-tested — the repo has no AsyncStorage mock yet.

**Contract**: Add `"setupFiles": ["<rootDir>/jest.setup.js"]` to the `"jest"` block in
`package.json`. `jest.setup.js` registers the official mock:
`jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));`.
Confirm the mock path against the installed package version before writing.

#### 3. Struggle-weighted ranking

**File**: `src/lib/vocabulary-ranking.ts`

**Intent**: Factor mark history into the sort so repeatedly-missed not-known words lead
their relevance tier, without changing tier order or determinism.

**Contract**: Change the signature to
`rankVocabulary(description: string, knownState: Record<string, boolean>, history?: MarkHistory): VocabularyWord[]`
with `history` defaulting to `{}` (import `MarkHistory` from `@/lib/vocabulary-store`).
Add an internal `struggleScore(word)` = `(history[word.id]?.timesUnknown ?? 0) - (history[word.id]?.timesKnown ?? 0)`.
After the matched-not-known round-robin list and the `unmatchedNotKnown` list are built,
re-order each by `struggleScore` descending with a stable tie-break on the element's
pre-sort position (decorate with index, sort, undecorate). Leave the matched-known and
unmatched-known passes untouched. The four-pass concatenation order (A→B→C→D) is
unchanged. Result stays a permutation of `SEED_VOCABULARY`; still no `Date` / `Math.random`.

#### 4. Unit tests

**File**: `src/lib/vocabulary-ranking.test.ts` (extend), `src/lib/vocabulary-store.test.ts` (new)

**Intent**: Pin the weighting behaviour and the history store's read/write contract.

**Contract**: In `vocabulary-ranking.test.ts` add cases: (a) given `history` where a
matched, not-known word has `timesUnknown` > 0 and others have none, that word is first
among the matched tier; (b) a struggled word whose category is *unmatched* still ranks
after every matched not-known word (tier dominance); (c) `history` does not move a
known-marked word out of the sunk tier; (d) `rankVocabulary(d, k)` and
`rankVocabulary(d, k, {})` return identical order (default is inert); (e) permutation
invariant still holds with a non-empty `history`. In `vocabulary-store.test.ts` (uses the
mock from change 2): `getMarkHistory()` returns `{}` when the key is unset; after
`recordMark(id, false)` then `recordMark(id, true)` the entry is `{ timesUnknown: 1, timesKnown: 1 }`;
a corrupt stored value yields `{}` without throwing; `recordMark` on an existing word
leaves other words' entries untouched.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Tests pass: `npm test`
- `npm test` runs the new `vocabulary-store.test.ts` cases (non-zero count, all green)

#### Manual Verification:

- Skim `rankVocabulary` output (via a scratch script, as in S-01) for a description with
  a hand-built `history` and confirm the struggled word leads its tier and the ordering
  still looks description-relevant

**Implementation Note**: After completing this phase and all automated verification passes,
pause for manual confirmation before proceeding.

---

## Phase 2: Wire history into the loop screen

### Overview

Load mark history in the loop screen, feed it to `rankVocabulary`, and record every mark.
Manual verification that the loop adapts across sessions.

### Changes Required:

#### 1. Loop screen wiring

**File**: `src/app/index.tsx`

**Intent**: Make the running app use and update the mark history.

**Contract**: Add `history` state (`MarkHistory`, initial `{}`). Extend the mount effect
so it loads known-state and history together (`Promise.all([getKnownState(), getMarkHistory()])`
then set both) — keep it a single `useCallback`-wrapped function called from the existing
`useEffect` to stay clear of `react-hooks/set-state-in-effect`. `handleSubmit` passes
`history` as the third argument to `rankVocabulary`. In `handleMark`, after
`await setWordKnownState(word.id, known)`, also `await recordMark(word.id, known)` and
merge the incremented entry into local `history` state. The existing `markingRef` guard
already serialises the pair. Import `getMarkHistory`, `recordMark`, and `MarkHistory`
from `@/lib/vocabulary-store`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Tests pass: `npm test`

#### Manual Verification:

- Run the app; mark one word "Don't know it" several times across a full app restart
  (rebuild the web static export or use a device), then submit a description matching that
  word's category — it appears at or near the top of its tier
- Mark a different word "Know it"; it stays at the bottom of subsequent queues even if it
  was marked "Don't know it" a couple of times earlier
- The top card still visibly relates to the description text (struggle didn't override
  relevance)
- No perceptible lag on submit

**Implementation Note**: After completing this phase and all automated verification passes,
pause for manual confirmation before considering the change complete.

---

## Testing Strategy

### Unit Tests:

- `src/lib/vocabulary-ranking.test.ts` (extended) — struggle reorders within a not-known
  tier, cannot cross tiers, does not unsink a known word; default `history` is inert;
  permutation invariant holds.
- `src/lib/vocabulary-store.test.ts` (new) — `getMarkHistory` default and corrupt-value
  handling; `recordMark` increments the correct counter and leaves siblings untouched.

### Integration Tests:

- None. The `index.tsx` wiring is manual-verified (consistent with S-01).

### Manual Testing Steps:

1. Build/run the app. Note the current top few cards for a business-flavoured description.
2. Mark one business word "Don't know it" 3 times, restarting the app between marks.
3. Re-enter the same description; confirm that word now leads the business tier.
4. Mark a different business word "Know it"; confirm it sits at the bottom of the queue
   on the next submit regardless of any earlier "Don't know it" marks.
5. Confirm the #1 card still clearly relates to the typed description.

## Performance Considerations

The history map is at most 72 small integer pairs. `getMarkHistory` is one AsyncStorage
read + JSON parse; `recordMark` is one read-merge-write on the shared queue. The struggle
sort is two `sort` calls over ≤72-element arrays. All well inside "perceptibly instant".

## Migration Notes

No migration. `vocabulary-mark-history` is absent for existing users and reads as `{}`;
history accumulates from first use. F-01's `vocabulary-known-state` key and contract are
untouched.

## References

- Roadmap: `context/foundation/roadmap.md` (`S-02`)
- PRD: `context/foundation/prd.md` (Success Criteria → Secondary; Business Logic)
- S-01: `context/changes/tailored-flashcard-loop/plan.md` +
  `reviews/impl-review.md` (the ranker seam and its determinism rules)
- Pattern references: `src/lib/vocabulary-store.ts` (`getKnownState` / `setWordKnownState`
  + `writeQueue`), `src/lib/vocabulary-ranking.ts` (four-pass sort), `src/app/index.tsx`
  (`loadKnownState` effect, `handleMark`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: History store + weighted ranker (pure, tested)

#### Automated

- [ ] 1.1 Type checking passes: `npx tsc --noEmit`
- [ ] 1.2 Linting passes: `npm run lint`
- [ ] 1.3 Tests pass: `npm test`
- [ ] 1.4 `npm test` runs the new `vocabulary-store.test.ts` cases (non-zero count, all green)

#### Manual

- [ ] 1.5 Scratch-script `rankVocabulary` output with a hand-built `history` shows the struggled word leading its tier and still description-relevant

### Phase 2: Wire history into the loop screen

#### Automated

- [ ] 2.1 Type checking passes: `npx tsc --noEmit`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Tests pass: `npm test`

#### Manual

- [ ] 2.4 A word marked "Don't know it" several times (across restarts) leads its tier on a matching description
- [ ] 2.5 A word marked "Know it" stays at the bottom regardless of earlier "Don't know it" marks
- [ ] 2.6 The top card still visibly relates to the description text
- [ ] 2.7 No perceptible lag on submit
