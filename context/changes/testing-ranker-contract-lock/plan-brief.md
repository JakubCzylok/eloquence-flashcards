# Ranker contract lock — Plan Brief

> Full plan: `context/changes/testing-ranker-contract-lock/plan.md`
> Research: `context/changes/testing-ranker-contract-lock/research.md`

## What & Why

Rollout Phase 1 of `context/foundation/test-plan.md`. Add unit tests that lock the two
contracts of `rankVocabulary` before the S-02 (struggle-weight tier) and S-03 (`deck`
parameter) branches change it:
- **Risk #1 — relevance**: a realistic person-description surfaces an on-topic word, and a
  weak incidental keyword hit does not crown an unrelated category.
- **Risk #2 — determinism + permutation**: identical arguments give the identical id
  order; the result is always exactly a permutation of the deck; the four ranking tiers
  concatenate in order; the category-score tie-break is deterministic.

## Starting Point

`rankVocabulary` (`src/lib/vocabulary-ranking.ts:144-181`) is pure — no I/O, no clock, no
randomness. `src/lib/vocabulary-ranking.test.ts` has 8 tests: R2's permutation invariant
is covered for the 2-arg form only, determinism once, R1 with two category-level checks.
Untested: the ≥3-category score-tie path, the cross-tier concatenation order, any
human-authored relevance expectation, and `CATEGORY_ORDER` ↔ `CATEGORY_KEYWORDS` sync.
`jest-expo` is wired; no new infra is needed for a pure function.

## Desired End State

`src/lib/vocabulary-ranking.test.ts` gains a reusable `assertRankInvariants` helper
(determinism + permutation, thunk-based so S-02/S-03 arg forms plug in later), a
tier-order monotonicity test, a deterministic tie-break test, a `CATEGORY_ORDER` sync
test, and a human-authored R1 expectation table driving ~6 passing relevance cases plus
~2 `it.failing` cases that document known keyword false-positives. `CATEGORY_ORDER` is
`export`ed (keyword only). `test-plan.md` §6.1 / §6.4 cookbook entries are filled in.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Test layer | unit only, extend the existing file | `rankVocabulary` is pure; unit is the only sensible layer | Research |
| Infra sub-phase | none | jest-expo already configured, function has no I/O — research flags an infra phase here as a mistake | Research |
| R2 helper shape | per-case `run` thunk (+ optional `deck`) | S-02's `history` arg and S-03's `deck` arg add cases with no helper rewrite | Plan |
| Tier-order check | monotonic `tierOf` sequence | pins the "4 passes in order" invariant without pinning specific words | Plan |
| `CATEGORY_ORDER` sync | one assertion; `export` the const | TS does not enforce the bare array covers the union — silent-failure path | Research |
| R1 assertion strictness | tiered: single-topic → `ranked[0].category`; multi → categories ⊆ top 5 | matches how round-robin works; catches a real regression without brittleness | User Q1 |
| R1 negative assertion | no word of a named off-topic *category* in top 3 | robust to lexicon edits within on-topic categories | User Q2 |
| R1 oracle authoring | drafted here (~8 rows), human reviews before code lands | keeps momentum; human still owns the final call | User Q3 |
| Known false-positives | `it.failing` cases, documented not fixed | they are Risk #1 gaps, not regressions; fixing = scope creep | Plan |
| Sub-phase order | 1.1 R2 mechanics → 1.2 R1 table → 1.3 cookbook | R2 has no authoring bottleneck — safety net lands fast | User Q4 |

## Scope

**In scope:** `assertRankInvariants` helper + R2 matrix/tier/tie/sync tests; the R1
expectation table + relevance tests (Part A passing, Part B `it.failing`); `export
CATEGORY_ORDER`; `test-plan.md` §6.1/§6.4.

**Out of scope:** e2e / component / integration tests; any behaviour or signature change
to `rankVocabulary`; fixing the keyword false-positives; testing the S-02 `history` /
S-03 `deck` arg forms (they do not exist yet); the "known word sinks after S-02" case;
full-order assertions; the AsyncStorage mock (Phase 2).

## Architecture / Approach

All changes are in one test file plus a one-keyword production edit. `assertRankInvariants`
takes cases as `{ name, run, deck? }` and checks determinism (run twice, equal id order)
and permutation (length + id-set vs `deck ?? SEED_VOCABULARY`). Tier order is a separate
focused test using a monotonic `tierOf` map. R1 is a data-table: category-level
assertions, expectations authored by a human reading each description, `it.failing` for
the two documented lexicon gaps.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1.1 R2 mechanics | reusable helper + determinism/permutation matrix + tier-order + tie-break + `CATEGORY_ORDER` sync | the tie-break test must assert *categories*, not word positions, or it becomes brittle |
| 1.2 R1 relevance | human-authored table → ~6 passing + ~2 `it.failing` relevance tests | oracle problem — every expectation must come from a human, not from running the lexicon |
| 1.3 cookbook | `test-plan.md` §6.1 + §6.4 filled in | keep it a recipe, not a duplicate of the test file |

**Prerequisites:** none — jest-expo is wired, the test file exists. Land before the
S-02/S-03 branches merge for a stronger baseline.
**Estimated effort:** ~1 session; the R1 table review is the human bottleneck.

## Open Risks & Assumptions

- The R1 table's Part A expectations were traced by hand against the current lexicon and
  should pass; if one does not, that is itself a Risk #1 finding to triage at implement
  time (narrow the expectation, or move it to Part B).
- `it.failing` behaves as described in `jest` 29 (via `jest-expo`) — passes when the body
  throws. Verify on first run.
- Merge with the S-02 / S-03 branches on the `export CATEGORY_ORDER` line is trivially
  additive.

## Success Criteria (Summary)

- `npm test` green (both `it.failing` cases pass by failing as expected); `tsc` + `lint`
  clean; suite grows from 8 to ~20+ cases.
- A human has confirmed every row of the R1 Part A + Part B tables.
- No assertion derives its expected value from `rankVocabulary` / `matchedCategories`.
- `test-plan.md` §6.1 and §6.4 are no longer placeholders.
