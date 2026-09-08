# Ranker contract lock — Phase 1 test rollout Implementation Plan

## Overview

Rollout Phase 1 of `context/foundation/test-plan.md`. Add unit tests that lock the two
contracts of `rankVocabulary` — **relevance** (Risk #1: a realistic description surfaces
an on-topic word, and a weak incidental keyword hit does not crown an unrelated category)
and **determinism + permutation** (Risk #2: identical arguments give the identical id
order; the result is always exactly a permutation of the deck; the four ranking tiers
concatenate in order). The point is to freeze what the ranker *correctly* does today so
the S-02 (struggle-weight tier) and S-03 (`deck` parameter) branches cannot silently
regress it.

Unit tests only. One production change: `export` the existing module-private
`CATEGORY_ORDER` constant so a test can assert it stays in sync with `CATEGORY_KEYWORDS`.

## Current State Analysis

- `src/lib/vocabulary-ranking.ts:144-181` — `rankVocabulary(description, knownState)`.
  Pure, no I/O, no clock, no randomness. Path: `tokenize` (`:67-74`, lowercase → split on
  `/[^a-z0-9]+/` → drop `< 3` chars and a 39-word stoplist, **no stemming**) →
  `matchedCategories` (`:77-96`, raw keyword-hit count per category, **no threshold**,
  ties broken by the fixed `CATEGORY_ORDER` at `:8-18` via an **explicit** comparator
  clause at `:92-94`) → four buckets (`:162-173`) → `roundRobin` (`:103-123`) for the
  matched tiers, seed order for the unmatched tiers → 4-way concatenation (`:175-180`).
- `src/constants/category-keywords.ts:17-292` — `CATEGORY_KEYWORDS: Record<VocabularyCategory, string[]>`.
  The hand-authored lexicon; its coverage is the real determinant of Risk #1.
- `src/constants/vocabulary.ts` — `SEED_VOCABULARY`, 72 words, 9 categories × 8; ids are
  kebab slugs. First id per category, file order: business→`acumen`, academic→`discourse`,
  arts-culture→`aesthetic`, science-tech→`algorithm`, current-events→`polarize`,
  travel→`itinerary`, food-cuisine→`palate`, sports-fitness→`resilience`,
  family-relationships→`rapport`.
- `src/lib/vocabulary-ranking.test.ts:1-72` — 8 existing tests. R2's permutation invariant
  is covered for the **2-argument form only** (5 descriptions, length + id-set at `:57-71`);
  determinism is covered **once** (`:52-55`). R1 has two category-level checks (`:10-24`).
  Untested: the ≥3-category score-tie path; the cross-tier concatenation order; any
  human-authored relevance expectation; `CATEGORY_ORDER` ↔ `CATEGORY_KEYWORDS` sync.
- Test infra: `jest-expo` preset + `"jest"` block in `package.json` (`moduleNameMapper`
  for `@/`), `"test": "jest"`. Test file imports `@jest/globals` and `SEED_VOCABULARY`
  directly. **No AsyncStorage mock, and none needed here** — `rankVocabulary` has no I/O.
- `context/changes/testing-ranker-contract-lock/research.md` — full grounding for both
  risks; verified the test plan's response guidance; explicitly states **no
  infrastructure-setup phase is required for this rollout phase**.
- Parallel branches (`feat/adaptive-card-ranking`, `feat/custom-flashcards`) will change
  `rankVocabulary`'s signature — S-02 adds `history?` (3rd), S-03 adds `deck?` (4th). The
  R2 helper is built so those forms plug in as extra cases with no helper rewrite.

## Desired End State

`src/lib/vocabulary-ranking.test.ts` gains:

- A reusable `assertRankInvariants(cases)` helper (determinism + permutation), fed a
  `{5 descriptions × 3 knownState shapes}` matrix for the current 2-arg form.
- A tier-order test: the result's per-word tier number (matched-not-known → matched-known
  → unmatched-not-known → unmatched-known) is monotonically non-decreasing.
- A tie-break test: a description that scores three categories at 1 produces a
  deterministic 3-category prefix ordered by `CATEGORY_ORDER`.
- A `CATEGORY_ORDER` ↔ `Object.keys(CATEGORY_KEYWORDS)` key-set equality test.
- A human-authored R1 expectation table (in this plan, reviewed before implementation)
  driving relevance tests: ~6 passing "relevance protection" cases + ~2 `it.failing`
  cases documenting known keyword false-positives.

`CATEGORY_ORDER` is `export`ed from `src/lib/vocabulary-ranking.ts` (keyword only, no
behaviour change).

`context/foundation/test-plan.md` §6.1 and §6.4 cookbook entries are filled in.

Verify: `npm test` all green (the `it.failing` cases pass because they fail as expected);
`npx tsc --noEmit` and `npm run lint` clean; a human has confirmed each row of the R1
table; no test derives an expected value by calling `rankVocabulary` / `matchedCategories`.

### Key Discoveries

- `src/lib/vocabulary-ranking.ts:92-94` — the category comparator already has an explicit
  `|| CATEGORY_ORDER.indexOf(...)` second key, so determinism does **not** depend on
  `Array.prototype.sort` stability. The gap is that the tie path is untested.
- `src/lib/vocabulary-ranking.ts:8-18` — `CATEGORY_ORDER` is a bare array; TypeScript does
  **not** enforce it covers the `VocabularyCategory` union, unlike `CATEGORY_KEYWORDS`
  (a `Record`). A category added to the union but forgotten here would be silently
  un-rankable. One assertion closes this.
- `src/app/index.tsx:40` + `handleMark` — `if (index + 1 >= queue.length) setPhase('done')`
  assumes `rankVocabulary` returns an exact 72-word permutation. That is why Risk #2's
  "never reaches its end screen" is a real user failure and why the permutation invariant
  must hold for every argument form S-02/S-03 introduce.
- Drafting the R1 table surfaced two genuine keyword false-positives in the current
  lexicon (documented in Phase 1 sub-phase 2). They are Risk #1 limitations, not
  regressions — hence `it.failing`, not a scope expansion.

## What We're NOT Doing

- **No e2e, no component tests, no integration tests** — `rankVocabulary` is pure; unit is
  the only sensible layer.
- **No infrastructure-setup sub-phase** — `jest-expo` is already configured, the test file
  exists, the function under test has no I/O. The AsyncStorage mock the *rollout* needs
  belongs to Phase 2 (`Storage safety net`), not here.
- **No change to `rankVocabulary`'s behaviour or signature** — the only production edit is
  adding the `export` keyword to the existing `CATEGORY_ORDER` const.
- **No fix for the keyword false-positives** found while drafting the R1 table — they are
  recorded as `it.failing` and left for a future scoring/lexicon improvement.
- **No test of the S-02 `history` arg or S-03 `deck` arg** — those parameters do not
  exist yet. The helper is *shaped* to accept them later; nothing is stubbed now.
- **No "after S-02 a known word still sinks even if struggled" test** — forward hook only.
- **No pinning of the full 72-word order for any description** — assertions are on
  properties (determinism, permutation, tier monotonicity, category prefix), never the
  whole sequence.

## Critical Implementation Details

**The R1 oracle must be human-authored.** Every expected value in the R1 table is a human
judgement of what a person would want to talk about, read off the description text — never
computed by calling `rankVocabulary` or `matchedCategories` in the test. A test that
derives its expectation from the code under test passes against a broken lexicon. The
table below is the contract; it is reviewed (Phase 1 manual verification) before any R1
test is written.

**Tier-order as monotonicity.** Define `tierOf(word, matchedSet, knownState)` →
`0` matched & not-known, `1` matched & known, `2` unmatched & not-known, `3` unmatched &
known. The invariant "the four passes concatenate in order" is exactly "the sequence of
`tierOf` values over the result is non-decreasing." Assert that; do not assert specific
words at specific indices.

**`it.failing` semantics.** `jest` (v29, via `jest-expo`) treats `it.failing(name, fn)` as
passing when `fn` throws and failing when `fn` unexpectedly passes. Use it for the two
known-false-positive R1 cases so `npm test` stays green today and turns red the moment
someone improves the scoring to fix them.

## Phase 1: Ranker contract lock (unit tests)

One phase, three ordered sub-phases: cheap pure-mechanics first (R2), then the
human-oracle work (R1), then the cookbook.

### Changes Required

#### 1. Sub-phase 1.1 — R2: determinism + permutation + tier order + tie path + sync

**File**: `src/lib/vocabulary-ranking.ts`

**Intent**: Make `CATEGORY_ORDER` importable so a test can assert it stays in sync with
the lexicon key set.

**Contract**: Add the `export` keyword to the existing
`const CATEGORY_ORDER: VocabularyCategory[] = [...]` at `:8`. No other change. (S-02 /
S-03 branches touching this region get a trivial additive merge.)

**File**: `src/lib/vocabulary-ranking.test.ts`

**Intent**: Lock Risk #2 — the ranker is deterministic, always returns an exact
permutation of the deck, concatenates its four tiers in order, and breaks category-score
ties deterministically — and add the free `CATEGORY_ORDER` sync check.

**Contract**:
- Add `assertRankInvariants(cases: { name: string; run: () => VocabularyWord[]; deck?: VocabularyWord[] }[])`.
  For each case it asserts: (a) **determinism** — `idsOf(run())` deep-equals `idsOf(run())`;
  (b) **permutation** — `run().length === (deck ?? SEED_VOCABULARY).length` and
  `new Set(idsOf(run()))` deep-equals `new Set((deck ?? SEED_VOCABULARY).map(w => w.id))`.
  The `run` thunk lets S-02/S-03 add `() => rankVocabulary(d, k, history)` /
  `() => rankVocabulary(d, k, {}, customDeck)` cases later with no helper change.
- Feed it a matrix: descriptions `['', 'zzz qqq wubble', "my new manager, a former startup founder", 'retired history professor who races bikes', 'my married coworker who loves cycling']`
  × knownState shapes `[{}, <a few ids true spread across the deck>, <all 72 ids true>]`
  — 15 cases, all on the 2-arg form.
- Add `it('concatenates the four ranking tiers in order', ...)` — for a description that
  yields both matched and unmatched words, with a knownState marking one matched and one
  unmatched word known, assert the sequence of `tierOf` values over the result is
  non-decreasing. (Implemented with `"a wine sommelier"` — matches `food-cuisine` only —
  not the `"startup founder"` this line first suggested: `startup` is dual-tagged
  `business` + `science-tech`, so it does not give a single-category matched set.)
- Add `it('breaks a three-category score tie deterministically by CATEGORY_ORDER', ...)` —
  for `'my married coworker who loves cycling'` with `{}`, assert
  `ranked.slice(0, 3).map(w => w.category)` equals `['business', 'sports-fitness', 'family-relationships']`
  and that it is identical across repeated calls. (Categories, not words.)
- Add `it('CATEGORY_ORDER covers exactly the CATEGORY_KEYWORDS key set', ...)` —
  `expect([...CATEGORY_ORDER].sort()).toEqual(Object.keys(CATEGORY_KEYWORDS).sort())`.

**Regression it catches**: an S-02/S-03 edit (or a lexicon change) that makes the ranker
non-reproducible, drop or duplicate a word, reorder the tiers, or make the tie-break
engine-dependent; a category added to `VocabularyCategory` but forgotten in `CATEGORY_ORDER`.

**Research source**: `research.md` §"Where Risk #2 passes through the code" and
§"Verifying the response guidance" rows for R2.

**Anti-pattern avoided**: pinning the full 72-word order; relying on `Array.prototype.sort`
stability (the code has an explicit tie-break, and the test asserts the *category* prefix,
not word positions).

#### 2. Sub-phase 1.2 — R1: human-authored expectation table + relevance tests

**File**: `src/lib/vocabulary-ranking.test.ts`

**Intent**: Lock Risk #1 — realistic person-descriptions surface an on-topic word, and
document (not fix) the cases where a weak incidental keyword misfires.

**Contract**: Drive a data-table test from the rows below. Assertions are **category-level**
(the illustrative word is context for the human reviewer, not asserted):
- single-topic row → `ranked[0].category === <expected category>`
- multi-topic row → `<expected categories>` is a subset of
  `new Set(ranked.slice(0, 5).map(w => w.category))`
- negative row → `ranked.slice(0, 3).every(w => w.category !== <off-topic category>)`
- Part B rows use `it.failing` with a comment naming the limitation.

**Part A — relevance protection (must pass on current code):**

| # | Description | Kind | Assertion | Why on-topic (human) |
|---|---|---|---|---|
| A1 | `my new manager, a former startup founder` | single | `ranked[0].category === 'business'` | a boss with a startup background — business register (acumen, leverage, stakeholder) |
| A2 | `my girlfriend's father, a retired history teacher` | multi | `{'academic','family-relationships'} ⊆ categories(top 5)` | meeting a partner's parent who taught history — relationship warmth + academic register |
| A3 | `a colleague who's really into trail running and cycling` | single | `ranked[0].category === 'sports-fitness'` | the running/cycling is the conversational hook |
| A4 | `a college friend who now works in finance and does a lot of cycling` | multi | `{'business','sports-fitness'} ⊆ categories(top 5)` | catching up — their finance career and their cycling |
| A5 | `my aunt, just back from backpacking around Southeast Asia` | single | `ranked[0].category === 'travel'` | the trip is what you would actually talk about |
| A6 | `a chef who runs a small farm-to-table restaurant` | single | `ranked[0].category === 'food-cuisine'` | food and cooking vocabulary (palate, artisanal, gastronomy) |

**Part B — known keyword false-positives (`it.failing`, document don't fix):**

| # | Description | Human expectation (the `it.failing` assertion) | Current behaviour | Limitation |
|---|---|---|---|---|
| B1 | `a coworker training for an Ironman` | `ranked[0].category === 'sports-fitness'` | leads with `business` — `coworker` (score 1) ties `training` (score 1); `business` wins the `CATEGORY_ORDER` tie | the scorer has no keyword salience — a score-1 role word ties a score-1 passion word, broken arbitrarily by category order |
| B2 | `a chef who runs a small farm-to-table restaurant` | `ranked.slice(0, 3).every(w => w.category !== 'sports-fitness')` | `resilience` (sports-fitness) at index 1 | keyword false positive — `run`/`runs` in `sports-fitness` matches the verb "to run [a restaurant]" |

**Regression it catches**: a lexicon edit (mis-categorised keyword, an over-broad keyword
like `data`/`work`/`race`) or an S-02/S-03 change that pushes an on-topic category out of
the top slot / top 5 for these descriptions. If a Part B `it.failing` case starts passing,
someone improved the scoring — the suite flags it.

**Research source**: `research.md` §"Where Risk #1 passes through the code" (the traced
"married coworker" example and the tokenizer/scorer/round-robin chain) and
§"Verifying the response guidance" rows for R1.

**Anti-pattern avoided**: the **oracle problem** — no expected category is computed by
calling `matchedCategories` / `rankVocabulary`; every value is a human reading the
description. No exact-word / full-order assertions.

#### 3. Sub-phase 1.3 — cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.1 and §6.4 placeholders with the patterns this phase shipped.

**Contract**:
- **§6.1 Adding a pure-logic unit test** — location (`src/lib/<module>.test.ts` next to the
  source), `@jest/globals` import style, `npm test` to run, the `assertRankInvariants`
  helper as the reference for signature-agnostic property tests, and the rule "assert
  properties, never the full output sequence."
- **§6.4 Adding a test for a new deck or lexicon rule** — how to add a row to the R1
  expectation table (pick descriptions of *people*; the expected category is a human
  judgement, never derived from the lexicon; use `it.failing` for a known gap), and how to
  extend `assertRankInvariants` with a new argument form (add a case with a `run` thunk
  and, if the deck differs, a `deck`).

### Success Criteria

#### Automated Verification

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Tests pass: `npm test` (all green — the two `it.failing` cases count as passing because
  they fail as expected)
- `npm test` reports the new cases running (R2 matrix + tier + tie + sync + R1 table) —
  the suite count grows from 8 to roughly 20+

#### Manual Verification

- A human reads the **Part A and Part B R1 tables above** and confirms each row's
  judgement — this is the oracle-ownership gate; do not write the R1 tests until the table
  is confirmed or edited
- Skim the finished test file: no assertion computes its expected value by calling
  `rankVocabulary` or `matchedCategories`
- Confirm the two `it.failing` cases are labelled with a comment naming the limitation, so
  a future reader understands why they are there

**Implementation Note**: After completing this phase and all automated verification passes,
pause for the human to confirm the R1 table judgements and the oracle-problem skim before
considering the phase complete.

---

## Testing Strategy

### Unit Tests

- All of the above — extensions to `src/lib/vocabulary-ranking.test.ts`. No new test file.

### Integration Tests

- None. `rankVocabulary` is pure; there is nothing to integrate.

### Manual Testing Steps

1. `npm test` — confirm green, note the new suite count.
2. Open `src/lib/vocabulary-ranking.test.ts`, read the R1 table rows against the
   descriptions, confirm each expected category is a sane human call.
3. Grep the file for `matchedCategories(` and `rankVocabulary(` inside `expect(` arguments
   — there should be none (oracle-problem check).

## Performance Considerations

None. The suite runs `rankVocabulary` (a sort over ≤72 elements) a few dozen times.
`jest-expo` start-up (~20–30s on this machine) dominates; the assertions are instant.

## Migration Notes

- `export CATEGORY_ORDER` is additive. If `feat/adaptive-card-ranking` or
  `feat/custom-flashcards` has already edited the `:1-18` region, the merge is a
  one-line addition.
- This phase does not touch `context/changes/adaptive-card-ranking/` or
  `context/changes/custom-flashcards/`. Those branches' own Phase 1 test work builds on a
  green `vocabulary-ranking.test.ts`; landing this first gives them a stronger baseline.

## References

- Research: `context/changes/testing-ranker-contract-lock/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (Risks #1, #2 + Risk Response Guidance),
  §3 Phase 1, §6.1/§6.4 (to fill)
- Ranker: `src/lib/vocabulary-ranking.ts:8-18` (`CATEGORY_ORDER`), `:67-96` (tokenize +
  score), `:103-123` (round-robin), `:144-181` (`rankVocabulary`)
- Lexicon: `src/constants/category-keywords.ts:17-292`
- Existing tests: `src/lib/vocabulary-ranking.test.ts:1-72`
- Consumer: `src/app/index.tsx:40` + `handleMark`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Ranker contract lock (unit tests)

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit` — 913c868
- [x] 1.2 Linting passes: `npm run lint` — 913c868
- [x] 1.3 Tests pass: `npm test` (all green, incl. the two `it.failing` cases) — 913c868
- [x] 1.4 Suite count grew (R2 matrix + tier + tie + `CATEGORY_ORDER` sync + R1 Part A/B all present) — 913c868

#### Manual

- [x] 1.5 Human confirmed every row of the R1 Part A + Part B tables (oracle-ownership gate) — 913c868
- [x] 1.6 File skim: no assertion computes its expected value via `rankVocabulary` / `matchedCategories` — 913c868
- [x] 1.7 Both `it.failing` cases carry a comment naming the limitation — 913c868
- [x] 1.8 `test-plan.md` §6.1 and §6.4 cookbook entries filled in — 913c868
