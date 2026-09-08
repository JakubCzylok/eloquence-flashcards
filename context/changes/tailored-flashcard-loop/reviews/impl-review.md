<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Tailored flashcard loop (S-01)

- **Plan**: context/changes/tailored-flashcard-loop/plan.md
- **Scope**: Phases 1–3 of 3 (full plan)
- **Date**: 2026-09-08
- **Verdict**: APPROVED
- **Findings**: 0 critical  1 warning  5 observations — all triaged, F1/F2/F3/F6 fixed, F4/F5 recorded

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (F1 — fixed) |
| Scope Discipline | PASS |
| Safety & Quality | PASS (F2, F3, F5 — observations) |
| Architecture | PASS |
| Pattern Consistency | PASS (F4 — observation) |
| Success Criteria | PASS (F6 — observation) |

Notes: changed-file list matches the plan exactly (+ `.npmrc` / `package-lock.json`
from the approved test-runner setup). `rankVocabulary()` is pure, deterministic, and
permutation-invariant (8 unit tests). Debug surface fully removed — the web static
export produced only `/`, `/explore`, `/_sitemap`, `/+not-found`. All automated gates
(`tsc`, `expo lint`, `npm test`, grep 3.4) verified green at HEAD before and after triage.

## Findings

### F1 — `multiline` on the description input contradicts the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/app/index.tsx:86–88 (pre-fix)
- **Detail**: Plan Phase 2 contract said "`ThemedTextInput` (multiline off)". The implementation passed `multiline`, which makes Return insert a newline instead of firing `onSubmitEditing` — so the `returnKeyType="go"` + `onSubmitEditing={handleSubmit}` wiring was dead on most platforms and submit worked only via the button.
- **Fix**: Applied — dropped `multiline` and removed the now-meaningless `styles.field` (`minHeight: 96` + `textAlignVertical: 'top'` only made sense for multiline). Return-to-submit restored; matches the plan.
- **Decision**: FIXED

### F2 — No keyboard avoidance on the input screen

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real device-only issue; fix changes layout
- **Dimension**: Safety & Quality
- **Location**: src/app/index.tsx safeArea (`justifyContent: 'center'`)
- **Detail**: The input phase vertically centered its content with no `KeyboardAvoidingView` / `ScrollView`. On a real device the on-screen keyboard can cover the centered input + submit button. Manual verification ran on the web static export, which can't surface this.
- **Fix**: Applied — wrapped the screen in `KeyboardAvoidingView` (`behavior` = `padding` on iOS, `height` on Android) inside the themed container; added `styles.keyboardView` (`flex: 1`, `maxWidth`). Still needs a real Android pass to confirm.
- **Decision**: FIXED

### F3 — Fast double-tap on a mark button can drop the second tap

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/app/index.tsx handleMark (deps `[queue, index]`)
- **Detail**: `handleMark` closed over `index`. A second tap fired during the first tap's `await setWordKnownState` re-ran with the stale `index`, re-marked the same word (idempotent), and recomputed the same `next` — so the second tap was silently lost. Non-corrupting.
- **Fix**: Applied — added a `markingRef` re-entrancy guard: while a mark write is in flight, further taps are ignored; state updates then fire once with this invocation's correct `index`.
- **Decision**: FIXED

### F4 — `ThemedTextInput` prop shape deviates from the plan (for the better)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/components/themed-text-input.tsx:6–8
- **Detail**: Plan said add `lightColor` / `darkColor` "mirroring `ThemedViewProps`". The implementation adds `themeColor?: ThemeColor` instead — which matches `themed-text.tsx` (the working pattern); `themed-view.tsx`'s `lightColor`/`darkColor` props are declared but never read. The deviation is an improvement.
- **Fix**: No code change. Recorded in `change.md` under "Deviations from plan.md".
- **Decision**: ACCEPTED (recorded)

### F5 — `.npmrc legacy-peer-deps=true` is repo-wide

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: .npmrc:4
- **Detail**: Added (user-approved during implementation) for the `jest-expo` ↔ `react-native` peer skew. It loosens peer resolution for every future `npm install` / `npm ci` in the repo, not just the jest packages — a genuinely incompatible peer won't error later.
- **Fix**: None. Recorded in `change.md`; revisit when Expo SDK / RN versions realign.
- **Decision**: ACCEPTED AS RISK (recorded)

### F6 — Vacuous sub-assertion in ranking test 1

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Success Criteria
- **Location**: src/lib/vocabulary-ranking.test.ts:14 (pre-fix)
- **Detail**: `expect(knownState[ranked[0].id]).toBeUndefined()` with `knownState = {}` was always true regardless of ranking. The "first card isn't known" property was already genuinely covered by the deprioritization test, so no coverage gap — the line just asserted nothing.
- **Fix**: Applied — test now marks the first business word known and asserts `ranked[0].category === 'business'` AND `ranked[0].id !== firstBusinessId`, so it verifies match-first and not-known-first together. Renamed to "puts a not-known word from the matched category first…". 8 tests still pass.
- **Decision**: FIXED

## Triage summary

- Fixed: F1, F2, F3, F6 — 4
- Recorded (no code change): F4, F5 — 2
- Skipped: none

## Post-triage verification

- `npx tsc --noEmit` → exit 0
- `npm run lint` → exit 0
- `npm test` → exit 0 (8 tests)
