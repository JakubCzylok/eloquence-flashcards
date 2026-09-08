# Tailored flashcard loop Implementation Plan

## Overview

Implement roadmap slice `S-01` — the north-star flow. The user types a short free-text
description of the person / interests they are about to talk to; the app ranks the F-01
seed vocabulary against that description with a rule-based (no-ML) matcher; it shows the
single most relevant card (word + definition); the user marks it known or unknown and
immediately sees the next card. Entirely on-device, no network, perceptibly instant.
This replaces the template home screen and consumes F-01's storage contract unchanged.

## Current State Analysis

- **F-01 is merged and provides the full data layer** (`src/lib/vocabulary-store.ts`,
  `src/constants/vocabulary.ts`):
  - `getSeedVocabulary(): VocabularyWord[]` — synchronous, returns `SEED_VOCABULARY`
    (72 words, 9 categories, 8 each; `{ id, word, definition, category }`).
  - `getKnownState(): Promise<Record<string, boolean>>` — AsyncStorage-backed, never throws.
  - `setWordKnownState(wordId, known): Promise<void>` — serialized read-merge-write; never
    deletes an entry ("deprioritized, never reset").
  - `VocabularyCategory` union: `business`, `academic`, `arts-culture`, `science-tech`,
    `current-events`, `travel`, `food-cuisine`, `sports-fitness`, `family-relationships`.
- **No navigation stack.** `src/app/_layout.tsx` renders `<AppTabs/>` directly inside a
  `ThemeProvider`. Routing is file-based via `NativeTabs` (`src/components/app-tabs.tsx`,
  native) and `Tabs` from `expo-router/ui` (`src/components/app-tabs.web.tsx`, web). Each
  declares a closed set of triggers. `src/app/index.tsx` and `src/app/explore.tsx` are
  still unmodified Expo template screens.
- **F-01 left a throwaway debug surface**: `src/app/debug-vocabulary.tsx` plus a temporary
  `debug-vocabulary` `<Trigger>` ("Debug") added to both `app-tabs.tsx` and
  `app-tabs.web.tsx` (commented "Temporary — remove alongside debug-vocabulary.tsx").
  F-01's impl-review and Migration Notes call for removing all three once a real UI exists.
- **UI kit**: `ThemedView` / `ThemedText` (typed variants, `themeColor` prop),
  `useTheme()` → `Colors[scheme]`, `Spacing` tokens (`half`..`six`), `react-native-reanimated`
  and `react-native-safe-area-context` are installed and used. **No `TextInput` anywhere
  in the repo yet.**
- **Config**: `app.json` has `experiments.typedRoutes: true` and
  `experiments.reactCompiler: true`. `tsconfig.json` maps `@/*` → `./src/*`. `strict: true`.
  No `babel.config.js`. No test runner (`AGENTS.md`: "No test runner is configured yet").
- **`npm run lint`** = `expo lint` (eslint-config-expo flat, `eslint.config.js` present
  since F-01); it enforces `react-hooks/*` rules because `reactCompiler` is on.
- The PRD's hard deadline (2026-08-27) has passed; the "2 days left, cut everything"
  framing in roadmap/PRD is stale. This plan introduces a minimal test runner accordingly.

## Desired End State

Opening the app lands on the loop screen (the home tab). The user sees a single-line
description input with an example placeholder and a submit control. On submit, the app
computes a ranked queue of all 72 words (most relevant first, words already marked known
sunk to the bottom) and shows the first card: the word and its definition together, with
"Know it" / "Don't know it" buttons. Marking either persists via `setWordKnownState` and
advances to the next card. A persistent "New description" control returns to the input
phase with the current text pre-filled. When the queue is exhausted the user sees a
terminal "You've reviewed every word for this description — start a new one" state with a
button back to input. Gibberish or zero-keyword input still produces a full, non-empty
queue (no dead-ends). `src/lib/vocabulary-ranking.ts` exports a pure, unit-tested
`rankVocabulary()` that S-01's screen and any future caller use. The F-01 debug screen and
its temporary tab triggers are gone.

Verify: run the app (`npm run android` / `web`), complete the loop end to end; submit a
multi-topic description and confirm the top cards span more than one category; mark a word
known, start a new description that would surface it, and confirm it appears below
equally-relevant unknown words; submit gibberish and confirm a card still appears;
exhaust a queue and confirm the terminal state; fully restart the app and confirm the
description field is empty but known-state persisted. `npm test`, `npx tsc --noEmit`, and
`npm run lint` all pass.

### Key Discoveries:

- F-01's `src/lib` vs `src/constants` split is the placement convention: plain logic →
  `src/lib/` (like `vocabulary-store.ts`); static data → `src/constants/` (like
  `vocabulary.ts`). Ranking logic goes in `lib/`; the keyword lexicon goes in `constants/`.
- `getKnownState()` is async but `getSeedVocabulary()` is sync — the screen must load
  known-state before it can rank. Follow the debug screen's pattern
  (`src/app/debug-vocabulary.tsx:18-24`): `getKnownState().then(setState)` in a `useEffect`.
- `react-hooks/set-state-in-effect` is enforced (reactCompiler). The debug screen sets
  state in an effect via a `useCallback` wrapper without tripping it
  (`src/app/debug-vocabulary.tsx:18-24`); mirror that shape.
- `typedRoutes: true` means an unreferenced screen file can surface in generated route
  types — deleting `debug-vocabulary.tsx` cleanly (Phase 3) avoids a dangling typed route.
- `themed-text.tsx` / `themed-view.tsx` are the component template: named export, props
  extend the RN primitive's props, `useTheme()` for colors, `StyleSheet.create()` at the
  bottom. A `ThemedTextInput` follows the same shape.
- `jest-expo` is the SDK-57 test preset. `babel-preset-expo` does not resolve tsconfig
  `paths`, so jest needs an explicit `moduleNameMapper` for `@/`.

## What We're NOT Doing

- **No ML / trained matching model** — PRD Non-Goals. Ranking is a keyword→category
  lexicon plus deterministic ordering.
- **No cross-session adaptive ranking** beyond "known words sink" — no per-word
  seen-count / unknown-frequency weighting. The Secondary criterion ("cards adapt over
  time") is covered only by known-state deprioritization; deeper adaptation is a separate
  future slice.
- **No navigation stack** — the loop is one screen with internal phase state, not
  multiple routes.
- **No description persistence** — the description lives in screen state only; it is
  never written to disk. Known-state persistence is F-01's, unchanged.
- **No tap-to-reveal / flip card** — word and definition are shown together.
- **No changes to `src/app/explore.tsx`** or its tab, and no relabel of the home tab —
  out of scope for S-01.
- **No manual "add flashcard" UI** (FR-004, Parked).
- **No new persisted keys or changes to F-01's storage contract.**
- **No component tests / integration tests / e2e** — only the pure `rankVocabulary()`
  function is unit-tested this slice.

## Implementation Approach

Three phases, each independently verifiable. Phase 1 builds and tests the ranking logic
with no UI dependency — it is pure and deterministic, so it is the one piece worth a test
runner. Phase 2 builds the loop screen on top of that function and F-01's store,
replacing the template home screen. Phase 3 removes F-01's throwaway debug surface —
deliberately last, so Phase 2's manual verification can still cross-check known-state
against the debug screen before it is deleted.

The ranking function takes `(description, knownState)` and returns the full 72-word list
in display order. Computing the whole list (not just the "relevant" subset) makes the
same function serve both the ranked result and the "no dead-ends" fallback, and keeps the
queue logic in the screen trivial: hold the array and an index, advance on mark, show the
terminal state when the index reaches the end.

## Critical Implementation Details

**Ranking determinism.** `rankVocabulary()` must be a pure function of its arguments with
no `Math.random`, no `Date`, no reliance on object key order beyond the seed array's
order. Equal-relevance ties break by the fixed index of the word in `SEED_VOCABULARY`.
This is what makes the unit tests meaningful and the on-screen order reproducible.

**Every word appears exactly once.** The returned array is a permutation of the 72 seed
words — no drops, no duplicates — regardless of description. Tests assert this invariant.

**Known-state is a snapshot.** The screen ranks once on submit using the `knownState` it
has loaded. Marking a card known mid-queue does not re-rank; the card just advances. The
effect of a known mark is visible on the *next* description (fresh `getKnownState()` +
fresh rank). This matches the "compute full ranked queue once on submit" decision.

**`@/` alias in jest.** Add `moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }` to the
jest config — `jest-expo` / `babel-preset-expo` will not resolve it from `tsconfig.json`.

**Effect-set-state lint rule.** `reactCompiler` enables `react-hooks/set-state-in-effect`.
Load known-state through a `useCallback`-wrapped async function called from `useEffect`,
mirroring `src/app/debug-vocabulary.tsx:18-24`, rather than an inline `setState` in the
effect body.

## Phase 1: Ranking logic + lexicon (pure, tested)

### Overview

The keyword→category lexicon, the pure `rankVocabulary()` function, and a minimal
`jest-expo` setup with unit tests for the function. No UI, no screen changes.

### Changes Required:

#### 1. Category keyword lexicon

**File**: `src/constants/category-keywords.ts` (new)

**Intent**: Provide the hand-authored mapping from everyday words a user would put in a
description (roles, hobbies, contexts) to the 9 vocabulary categories, so the matcher can
score a description without any model.

**Contract**: Exports `CATEGORY_KEYWORDS: Record<VocabularyCategory, string[]>` — every
category key from the `VocabularyCategory` union present, each mapping to an array of
lowercase single-word keywords/stems (roughly 8–15 per category; e.g. `business` →
`["work","boss","manager","startup","founder","client","office","corporate","finance","investor"]`;
`sports-fitness` → `["gym","run","running","bike","cycling","climb","marathon","football","yoga","coach"]`).
Keywords are matched as whole normalized tokens, so multi-word concepts are split into
their constituent words (`"weight lifting"` → `"weight"`, `"lifting"`). Import
`VocabularyCategory` from `@/constants/vocabulary`. No functions — data only.

#### 2. Ranking function

**File**: `src/lib/vocabulary-ranking.ts` (new)

**Intent**: The product's wedge — turn a free-text description into a fully ordered list
of the seed words, most relevant first, with already-known words deprioritized, using
only the lexicon and deterministic rules.

**Contract**: Exports `rankVocabulary(description: string, knownState: Record<string, boolean>): VocabularyWord[]`.
Behaviour:

1. **Normalize** the description: lowercase, split on `/[^a-z0-9]+/`, drop tokens shorter
   than 3 characters and a small inline stopword set (`the`, `and`, `for`, `who`, `with`,
   `that`, `they`, `she`, `him`, `her`, `about`, `going`, `talk`, …). Result: a `Set<string>`
   of description tokens.
2. **Score each category**: `score(category) = count of CATEGORY_KEYWORDS[category] entries
   present in the description-token set`. Categories with `score > 0` are "matched",
   ordered by `score` descending, then by category order in the union for ties.
3. **Build the ordered list** as the concatenation of four passes, each preserving
   `SEED_VOCABULARY` index order within it:
   - Pass A: matched-category words, `knownState[id] !== true`, emitted by round-robin
     across matched categories in matched order (take the next unemitted word of category 1,
     then category 2, …, wrapping until all matched not-known words are emitted).
   - Pass B: matched-category words, `knownState[id] === true`, same round-robin.
   - Pass C: unmatched-category words, `knownState[id] !== true`, in seed order.
   - Pass D: unmatched-category words, `knownState[id] === true`, in seed order.
4. If **no category is matched** (all scores 0), passes A/B are empty and the result is
   passes C/D — i.e. the full list, not-known first, seed order. Never empty, never throws.
5. The result is always a permutation of `getSeedVocabulary()` — every word once.

Pure function: no `Math.random`, no `Date`, no external state. Takes an optional third
arg `seed: VocabularyWord[] = getSeedVocabulary()` only if it makes the tests cleaner —
otherwise omit.

#### 3. Test runner setup

**File**: `package.json` (modify), `jest.config.js` (new, or a `"jest"` key — implementer's
call per the Expo guide)

**Intent**: Stand up the minimum `jest-expo` configuration needed to run one pure-TS test
file, so the ranking logic has regression protection.

**Contract**: `jest-expo` and `jest` added to `devDependencies` via
`npx expo install jest-expo jest` (plus `@types/jest` if the implementer wants typed
globals). A `"test": "jest"` script in `package.json`. Jest config sets
`preset: "jest-expo"` and `moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" }`.
**Per `AGENTS.md`'s hard rule, read `https://docs.expo.dev/versions/v57.0.0/` (Unit
Testing guide) for the exact current wiring before editing** — do not assume a
`babel.config.js` is needed or not.

#### 4. Ranking unit tests

**File**: `src/lib/vocabulary-ranking.test.ts` (new)

**Intent**: Pin the behaviour the screen depends on and the invariants that catch a
broken lexicon or seed-list edit.

**Contract**: Test cases:
- Single-topic description ("my new startup's investor") → first card's `category` is
  `business`, and it is not a known word.
- Multi-topic description ("retired history professor who races bikes") → the first ~6
  cards include at least two distinct categories (`academic` and `sports-fitness`).
- Deprioritization: given two words of equal relevance where one is `knownState[id] = true`,
  the not-known one precedes the known one.
- Fallback: `rankVocabulary("", {})` and `rankVocabulary("zzz qqq", {})` each return all
  72 words, not-known-before-known, no throw.
- Determinism: calling twice with identical args yields identical `id` order.
- Invariant: the result length is 72 and the set of `id`s equals the seed's set (no dup,
  no drop) for several different descriptions.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Tests pass: `npm test`
- `jest-expo` appears in `package.json` devDependencies and `npm test` runs a non-zero
  number of tests

#### Manual Verification:

- Eyeball `rankVocabulary()` output for 3–4 realistic descriptions (e.g. "girlfriend's
  dad, a wine-collecting cardiologist"; "coworker into trail running and startups") and
  confirm the top handful of words are recognisably on-topic
- Skim `CATEGORY_KEYWORDS` for obvious miscategorisations or a category with too few
  usable keywords

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual review was successful
before proceeding to the next phase.

---

## Phase 2: The loop screen

### Overview

Replace the template home screen with the description → card → mark → next loop, wiring
`rankVocabulary()` (Phase 1) to F-01's `getKnownState` / `setWordKnownState`. Add the two
presentational components the screen needs.

### Changes Required:

#### 1. Themed text input

**File**: `src/components/themed-text-input.tsx` (new)

**Intent**: A single-line text input styled from theme tokens, since the repo has no
`TextInput` usage or styling precedent yet.

**Contract**: Named export `ThemedTextInput`. Props extend React Native `TextInputProps`
and add optional `lightColor` / `darkColor` (mirroring `ThemedViewProps`). Uses
`useTheme()` for text, placeholder, and background/border colours;
`StyleSheet.create()` at the bottom. Follows `src/components/themed-text.tsx` structure.

#### 2. Flashcard component

**File**: `src/components/flashcard.tsx` (new)

**Intent**: Presentational card that shows one word with its definition and the two mark
actions — no data access, no ranking, no navigation.

**Contract**: Named export `Flashcard`. Props:
`{ word: VocabularyWord; known: boolean | undefined; onMark: (known: boolean) => void }`.
Renders the word (prominent), the category (secondary), the definition, and two buttons
("Know it" / "Don't know it") wired to `onMark(true)` / `onMark(false)`; the button
matching the current `known` value is visually marked selected (reuse the
`type="backgroundSelected"` treatment from `src/app/debug-vocabulary.tsx`). `ThemedView` /
`ThemedText` from `@/components`, `StyleSheet.create()` at the bottom.

#### 3. Loop screen

**File**: `src/app/index.tsx` (replace template content)

**Intent**: Own the loop's phase/queue state and orchestrate input → ranked queue → card
→ mark → next → done, using Phase 1's ranker and F-01's store.

**Contract**: `export default function HomeScreen()`. Internal state:
`phase: 'input' | 'card' | 'done'`, `description: string`, `queue: VocabularyWord[]`,
`index: number`, `knownState: Record<string, boolean>`.

- On mount: load `knownState` via a `useCallback`-wrapped `getKnownState().then(setKnownState)`
  called from `useEffect` (mirror `debug-vocabulary.tsx:18-24` to satisfy
  `react-hooks/set-state-in-effect`).
- **Input phase**: `ThemedTextInput` (multiline off) with an example placeholder
  ("e.g. my girlfriend's dad, a retired history teacher who races bikes"), a "Show me a
  word" submit button. Submit is disabled/no-op when the trimmed value is empty. On submit:
  `setQueue(rankVocabulary(description.trim(), knownState))`, `setIndex(0)`, `setPhase('card')`.
- **Card phase**: render `<Flashcard word={queue[index]} known={knownState[queue[index].id]}
  onMark={handleMark} />` plus a persistent "New description" control (returns to
  `phase: 'input'` with `description` kept in the field, `queue` cleared, `index` 0).
  `handleMark(known)`: `await setWordKnownState(queue[index].id, known)`, merge the value
  into local `knownState`, then if `index + 1 >= queue.length` set `phase: 'done'` else
  `setIndex(index + 1)`.
- **Done phase**: message "You've reviewed every word for this description." + a "New
  description" button back to the input phase.
- Layout follows `src/app/index.tsx` / `explore.tsx` conventions: `ThemedView` container,
  `SafeAreaView`, `Spacing` tokens, `StyleSheet.create()` at the bottom. Keep the whole
  loop in this one file.

**Note**: `queue` holding all 72 words is intentional — it is the "no dead-ends" fallback
for gibberish input as well as the normal ranked path.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Tests pass: `npm test`

#### Manual Verification:

- Launch (`npm run android` or `npm run web`); the home tab shows the description input
- Submit a single-topic description → a relevant card appears; "Know it" / "Don't know it"
  each advance to the next card with no lag
- Submit a multi-topic description → the first several cards visibly span more than one
  interest
- Mark a word "Know it", then submit a new description that would surface it → it appears
  below equally-relevant unknown words (cross-check against `/debug-vocabulary`, still
  present until Phase 3)
- Submit gibberish ("asdf qwer") → a card still appears, no crash, no empty screen
- Keep tapping through a queue to the end → the terminal "reviewed every word" state shows,
  with a working button back to input
- "New description" from the card phase returns to input with the previous text still in
  the field
- Fully close and reopen the app → input field is empty; previously known words are still
  marked known (persisted by F-01)

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that manual testing was successful
before proceeding to the next phase.

---

## Phase 3: Remove F-01 debug surface

### Overview

Delete the throwaway debug screen and the temporary tab triggers F-01 added for it, now
that the real loop screen exercises the storage contract.

### Changes Required:

#### 1. Delete the debug screen

**File**: `src/app/debug-vocabulary.tsx` (delete)

**Intent**: Remove the throwaway route; its purpose (manually proving the F-01 contract)
is now served by the loop screen.

**Contract**: File removed. No remaining imports reference it.

#### 2. Remove the temporary native tab trigger

**File**: `src/components/app-tabs.tsx` (modify)

**Intent**: Drop the temporary `debug-vocabulary` `<NativeTabs.Trigger>` block (the one
under the "Temporary — reachability for the F-01 debug screen" comment).

**Contract**: The `NativeTabs.Trigger` with `name="debug-vocabulary"` and its comment are
removed; the remaining triggers ("index", "explore") are unchanged.

#### 3. Remove the temporary web tab trigger

**File**: `src/components/app-tabs.web.tsx` (modify)

**Intent**: Same removal on the web tab list.

**Contract**: The `<TabTrigger name="debug-vocabulary" href="/debug-vocabulary" …>` block
and its comment are removed; "index" and "explore" triggers unchanged.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Tests pass: `npm test`
- No references remain: `grep -rn "debug-vocabulary" src/` returns nothing

#### Manual Verification:

- Launch the app; the tab bar shows only Home and Explore, no "Debug" tab
- Navigating to `/debug-vocabulary` directly no longer resolves (route removed)
- The loop screen still works end to end (no accidental coupling to the deleted screen)

**Implementation Note**: After completing this phase and all automated verification passes,
pause for manual confirmation before considering the change complete.

---

## Testing Strategy

### Unit Tests:

- `src/lib/vocabulary-ranking.test.ts` (Phase 1) — the pure `rankVocabulary()` function:
  single-topic match, multi-topic match, known-word deprioritization, gibberish/empty
  fallback, determinism, and the 72-word permutation invariant.

### Integration Tests:

- None. No component/integration/e2e runner this slice — the loop UI is verified manually.

### Manual Testing Steps:

1. `npm run android` (or `npm run web`); confirm the app opens on the description input.
2. Enter "my manager, who just got back from a hiking trip in Peru"; submit; confirm the
   first cards look travel/sports/business flavoured.
3. Tap "Know it" and "Don't know it" alternately for ~5 cards; confirm each advances
   instantly with no flicker.
4. Tap "New description"; confirm the text is still in the field; change it and resubmit.
5. Enter gibberish ("qwer asdf"); submit; confirm a card still shows.
6. From a fresh description, tap through until the terminal state; confirm the "start a
   new one" button returns to input.
7. Mark several words known; force-quit and reopen the app; start a description that would
   surface them; confirm they sort below unknown words of equal relevance.
8. Confirm the description field is empty after the restart (not persisted).
9. After Phase 3: confirm no "Debug" tab and the loop still works.

## Performance Considerations

The dataset is 72 words. Normalizing a short description, scoring 9 categories, and
building a 72-element array is sub-millisecond — well inside "perceptibly instant". Rank
once per submit; no memoization, virtualization, or web workers needed. The card list is
rendered one card at a time, not as a long list.

## Migration Notes

- No data migration. F-01's AsyncStorage key (`vocabulary-known-state`) and contract are
  untouched; existing known-state carries straight into the loop.
- Phase 3 deletes `src/app/debug-vocabulary.tsx` and the two temporary tab triggers —
  this completes F-01's own Migration Notes / impl-review follow-up.
- F-01's working-tree fixes from its impl-review (the `use-color-scheme.web.ts` lint
  disable and the `vocabulary-store.ts` write queue) should be committed before or with
  this change's first phase so `npm run lint` / `tsc` start green.

## References

- Roadmap: `context/foundation/roadmap.md` (`S-01`, and `F-01` for the data layer)
- PRD: `context/foundation/prd.md` (US-01, FR-001/002/003, Business Logic, NFRs, Non-Goals)
- F-01 change: `context/changes/seed-vocabulary-and-local-storage/plan.md` +
  `reviews/impl-review.md`
- Conventions: `AGENTS.md`
- Pattern references: `src/components/themed-text.tsx` (component shape),
  `src/app/debug-vocabulary.tsx:18-24` (async known-state load in an effect),
  `src/app/explore.tsx` (screen layout conventions)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Ranking logic + lexicon (pure, tested)

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Tests pass: `npm test`
- [x] 1.4 `jest-expo` in `package.json` devDependencies and `npm test` runs a non-zero number of tests

#### Manual

- [x] 1.5 `rankVocabulary()` output for 3–4 realistic descriptions has recognisably on-topic top words
- [x] 1.6 `CATEGORY_KEYWORDS` skimmed for miscategorisations / thin categories

### Phase 2: The loop screen

#### Automated

- [ ] 2.1 Type checking passes: `npx tsc --noEmit`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Tests pass: `npm test`

#### Manual

- [ ] 2.4 Home tab shows the description input on launch
- [ ] 2.5 Single-topic description yields a relevant card; both mark buttons advance with no lag
- [ ] 2.6 Multi-topic description's first several cards span more than one interest
- [ ] 2.7 A known-marked word sorts below equally-relevant unknown words on a new description
- [ ] 2.8 Gibberish input still produces a card, no crash
- [ ] 2.9 Exhausting a queue shows the terminal state with a working "new description" button
- [ ] 2.10 "New description" from the card phase returns to input with the previous text pre-filled
- [ ] 2.11 After a full app restart the input is empty but known-state persisted

### Phase 3: Remove F-01 debug surface

#### Automated

- [ ] 3.1 Type checking passes: `npx tsc --noEmit`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Tests pass: `npm test`
- [ ] 3.4 `grep -rn "debug-vocabulary" src/` returns nothing

#### Manual

- [ ] 3.5 Tab bar shows only Home and Explore, no "Debug" tab
- [ ] 3.6 `/debug-vocabulary` no longer resolves
- [ ] 3.7 The loop screen still works end to end
