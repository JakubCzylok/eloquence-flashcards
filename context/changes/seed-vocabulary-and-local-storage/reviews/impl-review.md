<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: On-device vocabulary store (F-01)

- **Plan**: context/changes/seed-vocabulary-and-local-storage/plan.md
- **Scope**: Phase 1–2 of 2 (full plan)
- **Date**: 2026-09-08
- **Verdict**: NEEDS ATTENTION → all findings fixed during triage
- **Findings**: 0 critical  3 warnings  1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (F4 — fixed) |
| Scope Discipline | WARNING (F2 — fixed) |
| Safety & Quality | WARNING (F3 — fixed) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL (F1 — fixed) |

Notes: core data-access contract (`getSeedVocabulary` / `getKnownState` /
`setWordKnownState`) matches the plan exactly. Seed dataset is 72 words across
9 categories (8 each), no duplicate ids, no category typos. `npx tsc --noEmit`
passed throughout; `npm run lint` was red at review start (F1) and is green
after fixes.

## Findings

### F1 — `npm run lint` fails; "Linting passes" gates marked complete

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: eslint.config.js (new) → error surfaced in src/hooks/use-color-scheme.web.ts:11
- **Detail**: Progress rows 1.2 and 2.2 ("Linting passes: `npm run lint`") are marked `[x]`, but on the reviewed tree `npm run lint` exited 1 with one `react-hooks/set-state-in-effect` error. This change introduced `eslint.config.js` (scaffolded by the plan's own `npm run lint` verification step, as AGENTS.md predicts), activating `eslint-config-expo/flat` repo-wide — including pre-existing scaffold files that violate the ruleset. This change's own files lint clean; the repo-wide gate was red and would block Module 3 hook/CI lint layers.
- **Fix**: Applied Fix A — added a scoped `// eslint-disable-next-line react-hooks/set-state-in-effect` with a rationale comment on the one-time client-hydration flip in `use-color-scheme.web.ts`. `npm run lint` now exits 0.
  - Strength: Makes the repo-wide gate green; preserves the standard Expo static-rendering hydration guard.
  - Tradeoff: Touched a scaffold file outside this change's nominal scope.
  - Confidence: HIGH — single call site, verified green.
  - Blind spot: None significant; lint output showed only this one error.
- **Decision**: FIXED via Fix A

### F2 — Unplanned flip-card animation + changed interaction model in debug screen

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/app/debug-vocabulary.tsx:3, 60–119
- **Detail**: Plan Phase 2 contract describes a flat list (word + definition + category visible, "tap any word to toggle its state"). Implementation builds a `react-native-reanimated` 3D flip card (front: word + category; back: definition) with separate ✓/✗ tri-state (`undefined`/`true`/`false`) controls. `react-native-reanimated` and `react-native-safe-area-context` were already project deps — no new packages. Consequence: manual criterion 2.3 ("all ~70 words render with word, definition, and category") is only verifiable by flipping each of 70 cards; it is marked `[x]` regardless. Screen is throwaway (deleted with S-01) and works.
- **Fix**: Applied — documented the UI-shape deviation in `change.md` under a new "UI shape deviation" subsection, including the note that criterion 2.3 requires flipping each card.
- **Decision**: FIXED (documented in change.md)

### F3 — `setWordKnownState` read-merge-write is not atomic (plan flaw carried into code)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/vocabulary-store.ts:23–27 (pre-fix)
- **Detail**: The plan's "Critical Implementation Details" requires that "concurrent-looking taps never clobber unrelated entries" and prescribes read → set one key → write whole map. The code followed that literally, but read-merge-write is not atomic: two overlapping `setWordKnownState` calls both read the same snapshot, each merges its own key, the later `setItem` wins, and the other write is lost. The debug screen's `handleSetKnown` is async and fires per tap with no serialization. S-01 will build directly on this contract.
- **Fix**: Applied Fix A — serialized writes through a module-level promise chain (`writeQueue`), with `run.catch(() => {})` kept as the chain tail so a failed write doesn't wedge the queue while callers still see the rejection. `tsc` and `lint` green.
  - Strength: Guarantees merges never interleave; preserves the `{}`-map contract S-01 expects; no API-surface change.
  - Tradeoff: A few lines of module-level state in vocabulary-store.ts.
  - Confidence: HIGH — standard single-writer-queue pattern, verified with tsc.
  - Blind spot: None significant at single-user / on-device scale.
- **Decision**: FIXED via Fix A

### F4 — plan.md not updated for the approved tab-trigger deviation

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/seed-vocabulary-and-local-storage/plan.md:27, 95, 135–137
- **Detail**: The temporary `debug-vocabulary` tab triggers (added to `app-tabs.tsx` + `app-tabs.web.tsx`, user-approved, recorded in `change.md`) contradicted `plan.md`, which still said "not wired into `AppTabs`" in the "What We're NOT Doing" list and the Phase 2 contract, and whose Migration Notes listed only the screen file for removal. S-01's implementer reads `plan.md`, not `change.md`, and could ship the temporary Debug tab.
- **Fix**: Applied — annotated both "not wired into AppTabs" lines in plan.md as superseded (pointing to change.md), and extended Migration Notes to name both tab files whose temporary `<Trigger>` block must be removed with the debug route.
- **Decision**: FIXED

## Triage summary

- Fixed: F1 (Fix A), F2 (doc), F3 (Fix A), F4 (doc) — 4
- Skipped: none
- Accepted as risk: none
- Recorded as lesson: none

## Post-triage verification

- `npx tsc --noEmit` → exit 0
- `npm run lint` → exit 0
