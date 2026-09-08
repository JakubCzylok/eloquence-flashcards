<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Ranker contract lock (test rollout Phase 1)

- **Plan**: context/changes/testing-ranker-contract-lock/plan.md
- **Scope**: Phase 1 of 1
- **Date**: 2026-09-08
- **Verdict**: APPROVED
- **Findings**: 0 critical  0 warnings  3 observations — F1 noted, F2 fixed, F3 skipped

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (F1 — a documented adaptation) |
| Scope Discipline | PASS |
| Safety & Quality | PASS (F2 — fixed; F3 — accepted) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

All three sub-phases delivered as planned. `src/lib/vocabulary-ranking.test.ts`
grew 8 → 20 tests; one production change (`export CATEGORY_ORDER`, keyword only);
`test-plan.md` §6.1/§6.4 cookbook filled. `tsc` / `expo lint` / `npm test` (20)
green at HEAD. Oracle-problem discipline verified by grep — no assertion derives
its expected value from `rankVocabulary` / `matchedCategories`.

## Findings

### F1 — Tier-order test uses a different description than the plan's example

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: src/lib/vocabulary-ranking.test.ts (tier-order test)
- **Detail**: The plan's sub-phase 1.1 illustrated the tier-order test with
  "startup founder" (claimed to match business only). That failed during
  implementation — `startup` is dual-tagged (`business` + `science-tech` in the
  lexicon), so the matched set was not single-category and the monotonicity
  assertion broke. Swapped to "a wine sommelier" (matches `food-cuisine` only;
  both keywords appear in no other category). Within the plan's stated contract;
  the test comment explains the oracle.
- **Fix**: Noted — a clarifying line added to plan.md sub-phase 1.1.
- **Decision**: NOTED (documented adaptation, no code change)

### F2 — assertRankInvariants called run() three times per case

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality (efficiency)
- **Location**: src/lib/vocabulary-ranking.test.ts (assertRankInvariants)
- **Detail**: The helper did `idsOf(c.run())` twice for the determinism check
  then `c.run()` a third time for the permutation check. Two calls suffice.
  ~45 extra sub-millisecond `rank()` calls across the 15-case matrix.
- **Fix**: Applied — helper now captures `first = c.run(); second = c.run();`,
  compares `idsOf(first)`/`idsOf(second)`, and runs the length + id-set asserts
  on `first`.
- **Decision**: FIXED

### F3 — it.failing markers pass on any throw, not only the intended assertion

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/lib/vocabulary-ranking.test.ts (B1, B2)
- **Detail**: `it.failing` treats the test as passing whenever the body throws.
  A future unrelated bug in one of those two 2-line bodies would be masked
  rather than surfaced. Inherent to `it.failing` as a documented-gap marker;
  very low risk given the bodies only call `rankVocabulary` + one assertion.
- **Fix**: None — accepted as-is. Adding a sanity check before the `it.failing`
  assertion would muddy the "known gap" intent.
- **Decision**: SKIPPED (accepted risk)

## Triage summary

- Fixed: F2 — 1
- Noted (doc): F1 — 1
- Skipped / accepted: F3 — 1

## Post-triage verification

- `npx tsc --noEmit` → exit 0
- `npm run lint` → exit 0
- `npm test` → exit 0 (20 tests)
