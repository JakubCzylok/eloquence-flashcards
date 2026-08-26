# On-device vocabulary store Implementation Plan

## Overview

Implement roadmap item `F-01`: a minimal on-device vocabulary store — a static, curated seed dataset of vocabulary words (word + definition + category) plus an AsyncStorage-backed known/unknown state — exposed through a small data-access module. Includes a throwaway debug screen for manual verification, since no UI or test runner exists yet. This foundation unlocks `S-01` (the tailored-flashcard loop); it does not implement any matching/ranking logic — that is `S-01`'s scope.

## Current State Analysis

The repo is the fresh Expo Router scaffold produced by `/10x-bootstrapper`. `src/app/` contains only default template screens (`_layout.tsx`, `index.tsx`, `explore.tsx` — confirmed via a domain-term grep across `src/`, zero matches for "flashcard"/"vocabulary"/"known"/"deck"/"word"). No persistence library (AsyncStorage/SQLite/MMKV) is listed in `package.json`. No vocabulary/data files exist anywhere in the repo. No test runner is configured (`AGENTS.md`: "No test runner is configured yet"). EAS deployment is already configured and a first Android preview build was verified earlier this session (`context/deployment/deploy-plan.md`) — unrelated to this change, but confirms the app currently boots to the unmodified Expo template UI.

## Desired End State

A developer opens the app, navigates to a temporary debug route, sees the full seed vocabulary list rendered (word, definition, category), taps any word to toggle known/unknown, and after a full app restart sees that state was preserved. `getSeedVocabulary()`, `getKnownState()`, and `setWordKnownState()` exist as a stable data-access contract that `S-01` will import directly, without needing to know AsyncStorage is involved underneath.

### Key Discoveries:

- No app-specific code exists yet — `src/app/index.tsx`/`explore.tsx`/`_layout.tsx` are all unmodified template files.
- Existing conventions (`AGENTS.md`, `tsconfig.json`): kebab-case filenames, PascalCase named exports for non-route files, `export default` for route files under `src/app/`, `@/*` import alias, `StyleSheet.create()` at the bottom of the file, TypeScript strict mode.
- `@react-native-async-storage/async-storage` is the correct SDK-57-compatible package (confirmed against `docs.expo.dev/versions/v57.0.0/sdk/async-storage/`). Must be installed via `npx expo install @react-native-async-storage/async-storage`, not plain `npm install`, so Expo resolves and pins the SDK-compatible version.
- This plan introduces a new `src/lib/` folder for plain data-access modules — not a React hook (no `useState`/`useEffect`), so it doesn't belong under `src/hooks/`, and not static config data, so it doesn't belong under `src/constants/`.

## What We're NOT Doing

- No matching/ranking algorithm — `S-01`'s scope, per the roadmap's Foundation Scope Cap.
- No manual "add flashcard" UI (`FR-004`) — Parked in the roadmap.
- No test runner setup (Jest, etc.) — user chose the throwaway debug-screen verification path over introducing a new test framework this late in the 2-day timeline.
- No permanent navigation entry for the debug screen — it's a throwaway route, not wired into `AppTabs`.
- No SQLite/MMKV — user chose AsyncStorage.
- No difficulty/frequency scoring field on vocabulary words — user chose the plain category-enum shape.
- No reset-all-progress action — known state is deprioritized, never deleted or reset, per user's choice.

## Implementation Approach

Two phases: first the data module (types, static seed dataset, AsyncStorage-backed read/write functions, no UI dependency), then a throwaway debug screen that exercises that module end-to-end and proves the storage contract survives a full app restart. This keeps the Foundation minimal (data access only) while still producing a real, manually-verifiable artifact before `S-01` needs it.

## Critical Implementation Details

**State sequencing**: known/unknown state is stored as a single JSON-serialized map (`Record<wordId, boolean>`) under one AsyncStorage key — not one key per word. `setWordKnownState` must read-merge-write the whole map each call (read current map → set the one key → write the whole map back) so concurrent-looking taps never clobber unrelated entries. This is the contract `S-01` will rely on; getting it right here avoids a rewrite later.

## Phase 1: Vocabulary data module

### Overview

Static seed dataset (types + curated content) and the AsyncStorage-backed data-access functions, with no UI dependency.

### Changes Required:

#### 1. Vocabulary types + seed dataset

**File**: `src/constants/vocabulary.ts`

**Intent**: Define the `VocabularyWord` shape and category enum, and provide the curated seed dataset that `S-01` will rank against.

**Contract**: Exports `VocabularyCategory` (union of 9 category string literals: `business`, `academic`, `arts-culture`, `science-tech`, `current-events`, `travel`, `food-cuisine`, `sports-fitness`, `family-relationships` — chosen to cover the PRD persona's named contexts: acquaintances, family members, mentors, professional/social settings), `VocabularyWord = { id: string; word: string; definition: string; category: VocabularyCategory }`, and `SEED_VOCABULARY: VocabularyWord[]` with roughly 8 words per category (~70 words total). Each `id` is a stable kebab-case slug of the word (e.g. `paradigm-shift`) so known/unknown state keys stay stable across app restarts even if array order changes. Definitions are single sentences, dictionary-style, no code needed to write these — plain content authoring during implementation.

#### 2. On-device storage functions

**File**: `src/lib/vocabulary-store.ts`

**Intent**: Provide the `F-01` data-access surface `S-01` will consume: read the seed list, and read/write per-word known/unknown state, backed by AsyncStorage.

**Contract**: Exports `getSeedVocabulary(): VocabularyWord[]` (returns `SEED_VOCABULARY` directly — synchronous, no I/O), `getKnownState(): Promise<Record<string, boolean>>` (reads the single AsyncStorage key `vocabulary-known-state`, JSON-parses it, returns `{}` if unset or on parse failure — never throws), and `setWordKnownState(wordId: string, known: boolean): Promise<void>` (implements the read-merge-write contract from Critical Implementation Details above — never deletes an existing entry, matching the "deprioritized, never reset" decision).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- `@react-native-async-storage/async-storage` appears in `package.json` dependencies after `npx expo install @react-native-async-storage/async-storage`

#### Manual Verification:

- Skim `SEED_VOCABULARY` for duplicate `id`s or category typos (visual review of the file)
- Confirm each of the 9 categories has at least 5 words, so `S-01`'s matching has real signal to work with in every category

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Debug verification screen

### Overview

A temporary, throwaway route that exercises the Phase 1 module end-to-end: list rendering, known/unknown toggling, and restart-persistence.

### Changes Required:

#### 1. Debug vocabulary screen

**File**: `src/app/debug-vocabulary.tsx`

**Intent**: Prove the `F-01` storage contract works end-to-end without waiting for `S-01`'s real UI — render the full seed list with each word's category and current known/unknown status, let the developer tap a word to toggle its state via `setWordKnownState`, and reload state via `getKnownState` on mount so a full app restart visibly preserves prior taps.

**Contract**: `export default function DebugVocabularyScreen()`, follows existing screen conventions (`ThemedView`/`ThemedText` from `@/components`, `StyleSheet.create()` at the bottom). Reached only via the direct route `/debug-vocabulary` during manual testing — no entry is added to `AppTabs`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Run `npm run android` (or `ios`/`web`), navigate to `/debug-vocabulary`, and confirm all ~70 seed words render with word, definition, and category
- Tap several words and confirm each known/unknown indicator updates immediately
- Fully close and reopen the app (not just reload JS), navigate back to `/debug-vocabulary`, and confirm the previously tapped words still show their updated known/unknown state

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

None — no test runner is configured in this repo, and the user chose the throwaway debug-screen path over introducing one for this Foundation.

### Integration Tests:

None, for the same reason.

### Manual Testing Steps:

1. Run `npm run android` (or `ios`/`web`) and navigate to `/debug-vocabulary`.
2. Confirm the full seed list renders with word, definition, and category for all ~70 entries.
3. Tap several words across different categories; confirm each known/unknown indicator updates immediately.
4. Fully restart the app (not just a JS reload) and revisit `/debug-vocabulary`; confirm the previously toggled words still show their updated state.

## Performance Considerations

The dataset is ~70 words (a few KB of JSON) — well within AsyncStorage's practical limits, and trivially fast to read, parse, and render. No pagination, memoization, or lazy loading is needed at this scale.

## Migration Notes

`src/app/debug-vocabulary.tsx` is throwaway. Once `S-01` ships a real UI over the same `vocabulary-store.ts` functions, either delete the debug route or leave it as a permanent dev-only route — no FR requires either choice, so it's a judgment call at that point.

## References

- Roadmap: `context/foundation/roadmap.md` (`F-01`)
- PRD: `context/foundation/prd.md`
- Conventions: `AGENTS.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Vocabulary data module

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit` — 6a20342
- [x] 1.2 Linting passes: `npm run lint` — 6a20342
- [x] 1.3 `@react-native-async-storage/async-storage` appears in `package.json` dependencies — 6a20342

#### Manual

- [x] 1.4 Skim `SEED_VOCABULARY` for duplicate `id`s or category typos — 6a20342
- [x] 1.5 Confirm each of the 9 categories has at least 5 words — 6a20342

### Phase 2: Debug verification screen

#### Automated

- [x] 2.1 Type checking passes: `npx tsc --noEmit`
- [x] 2.2 Linting passes: `npm run lint`

#### Manual

- [x] 2.3 All ~70 seed words render with word, definition, and category at `/debug-vocabulary`
- [x] 2.4 Tapping a word toggles its known/unknown indicator immediately
- [x] 2.5 State survives a full app restart
