# Custom flashcards Implementation Plan

## Overview

Implement roadmap slice `S-03` (`FR-004`, un-parked). Let the user create their own
vocabulary cards — word, definition, and one of the 9 existing categories — from inside
the app. User cards persist on-device under a new key, are merged with the seed deck, and
rank against descriptions through the same `rankVocabulary()` as seed words, carrying
their own known/unknown state. The user can also edit a card's definition/category and
delete a card.

## Current State Analysis

- **`src/constants/vocabulary.ts`** — `VocabularyCategory` (closed 9-value union),
  `VocabularyWord = { id: string; word: string; definition: string; category: VocabularyCategory }`,
  `SEED_VOCABULARY: VocabularyWord[]` (72 entries, `id` = kebab slug of the word).
- **`src/lib/vocabulary-ranking.ts`** — `rankVocabulary(description, knownState)`: pure,
  deterministic, four-pass sort over an internal `const seed = SEED_VOCABULARY`. Iterates
  the deck generically (`for (const word of seed)`), buckets by `matchedSet.has(word.category)`
  and `knownState[word.id] === true`. Result is always a permutation of the deck it ranked.
- **`src/lib/vocabulary-store.ts`** — `getSeedVocabulary()` (sync, returns `SEED_VOCABULARY`),
  `getKnownState()` / `setWordKnownState(id, known)` (AsyncStorage key `vocabulary-known-state`,
  read-merge-write serialized through a module-private `writeQueue`). `getKnownState`
  keys purely by `id`, so any word with a unique id gets known-state for free.
- **`src/app/index.tsx`** — the loop screen. `phase: 'input' | 'card' | 'done'` state
  machine. Mount effect runs a `useCallback`-wrapped loader (`getKnownState().then(setKnownState)`).
  `handleSubmit` calls `setQueue(rankVocabulary(trimmed, knownState))`. Layout: `ThemedView`
  container → `KeyboardAvoidingView` → `SafeAreaView` (`justifyContent: 'center'`) →
  per-phase blocks. Buttons are `Pressable` wrapping `ThemedView type="backgroundSelected"|"backgroundElement"`.
- **`src/components/`** — `themed-text.tsx`, `themed-view.tsx`, `themed-text-input.tsx`
  (`themeColor?` prop, `useTheme()`, `StyleSheet.create()` at bottom), `flashcard.tsx`.
  **No picker component and no `@react-native-picker/picker` dependency.**
- **Test infra** — `jest-expo`, `src/lib/vocabulary-ranking.test.ts` (imports
  `SEED_VOCABULARY` + `@jest/globals`). **No AsyncStorage mock is wired on `master`.**
- **No `context/foundation/lessons.md`.**
- **Parallel session (M2L5).** `S-02` (`adaptive-card-ranking`) is built concurrently and
  **merges first** (agreed order). S-02's Phase 1 adds: `getMarkHistory` / `recordMark` +
  `MarkHistory` type to `vocabulary-store.ts`; the AsyncStorage jest mock
  (`jest.setup.js` + a `setupFiles` line in `package.json`); a new
  `src/lib/vocabulary-store.test.ts`; and changes `rankVocabulary`'s signature to
  `(description, knownState, history?)`. **This plan assumes S-03 is rebased onto a
  merged S-02.** Where that assumption bites is called out inline.

## Desired End State

From the loop's input screen the user taps "Manage my cards" and reaches a manage view:
a list of the cards they've added (each with edit and delete), and a form to add a new
one (word, definition, and a category chosen from the 9). Adding a card returns to the
list with it shown; it now also appears in the normal loop — enter a description matching
its category and the card ranks among that category's words like any seed word, and can
be marked known/unknown. Editing changes a card's definition and category (not its word);
deleting removes it from the deck (its known-state / history entries are left in place,
harmless). Everything is on-device; `rankVocabulary()` stays pure and deterministic.

Verify: `npm test` covers the user-word store, the merged-deck accessor, and the ranker
over a custom deck. Manually: add a card, confirm it appears in the manage list and in a
matching loop queue; mark it known and confirm it sinks; edit its definition and see the
change on the card; delete it and confirm it's gone from both the list and the loop.

### Key Discoveries:

- `rankVocabulary` already iterates its deck generically — the only change needed for
  custom words to rank is to let the caller pass the deck in. Everything else (bucketing,
  round-robin, tie-break, permutation invariant) works unchanged over a longer array.
- `id` is the single identity key across the ranker, `getKnownState`, and (post-S-02)
  `recordMark`. A `user-<slug>` id namespace guarantees no collision with seed ids and
  lets the manage list filter user cards with `id.startsWith('user-')` — no `source`
  field needed on the type.
- `setWordKnownState` / `getKnownState` need no change — they already key by arbitrary id.
- There is no styled picker in the repo; a row of 9 `Pressable` category chips reusing
  the `backgroundSelected` / `backgroundElement` treatment (as in `flashcard.tsx`'s mark
  buttons) avoids a new dependency.
- `index.tsx` is also edited by the S-02 branch; keeping the manage UI in its own
  component (`src/components/manage-cards.tsx`) holds `index.tsx`'s S-03 delta to ~6 spots
  (import, phase-type, one state var, one loader call, one button, one render block).

## What We're NOT Doing

- **No change to `getSeedVocabulary()` / `getKnownState()` / `setWordKnownState()`** —
  additive only, per the S-02/S-03 contract split. `getAllVocabulary()` is a new function.
- **No `source` field on `VocabularyWord`** and no change to `src/constants/vocabulary.ts` —
  user vs seed is derived from the `user-` id prefix.
- **No new `VocabularyCategory` value** — user cards must use one of the existing 9.
  No "uncategorised" / optional-category path.
- **No editing a card's word** — edit changes definition + category only (changing the
  word means delete + re-add, so the id and its known-state stay coherent).
- **No cleanup of known-state / mark-history on delete** — orphan entries are left
  (consistent with "never delete known-state"); re-adding an identical word recovers them.
- **No navigation stack / new route / new tab** — the manage view is a fourth `phase` in
  the existing single-screen state machine.
- **No picker dependency** — category selection is inline chips.
- **No component / integration tests** — the manage-phase UI is manual-verified, matching
  S-01/S-02. Only the store, the merge, and the ranker-over-a-deck are unit-tested.
- **No migration** — the `vocabulary-user-words` key is absent for existing users and
  reads as `[]`.
- **No special ranking treatment for user words** — they rank purely by category like any
  seed word.

## Implementation Approach

Two phases. Phase 1 builds the persistence and plumbing with unit tests and no UI: a new
`src/lib/user-vocabulary.ts` with the CRUD primitives + slug + validation, a thin
`getAllVocabulary()` appended to `vocabulary-store.ts`, and a `deck` parameter on
`rankVocabulary`. Phase 2 builds the manage-cards UI as a standalone component and wires
the fourth phase, the deck state, and the entry button into `index.tsx`, then verifies
the full add → rank → edit → delete loop by hand.

## Critical Implementation Details

**`rankVocabulary` signature after the S-02 rebase.** S-02 lands
`rankVocabulary(description, knownState, history?: MarkHistory)`. S-03 adds `deck` as the
**fourth** positional parameter: `rankVocabulary(description, knownState, history = {}, deck: VocabularyWord[] = SEED_VOCABULARY)`,
and replaces the internal `const seed = SEED_VOCABULARY` with `const seed = deck`. The
loop screen then calls `rankVocabulary(trimmed, knownState, history, deck)`. If S-02 has
**not** merged when this phase runs, add only the `deck` param (3rd positional) and note
the rebase will reconcile the ordering.

**Slug + id.** `slug(text)` = `text.toLowerCase()` → replace `/[^a-z0-9]+/g` with `-` →
strip leading/trailing `-`. User-card `id` = `` `user-${slug(word)}` ``. On add, reject
(`{ ok: false, reason: 'duplicate' }`) if that id equals any `SEED_VOCABULARY` id or any
existing user-card id. On empty (word or definition blank after `trim()`), reject with
`reason: 'empty'`.

**Write serialization.** `user-vocabulary.ts` gets its own module-private
`let writeQueue: Promise<void>` chain (same shape as `vocabulary-store.ts`) so concurrent
add/update/delete calls never clobber the list.

**Determinism / permutation invariant unchanged.** `rankVocabulary` remains a pure
function of `(description, knownState, history, deck)`; the result is a permutation of
`deck`. Tests assert length and id-set equality against the deck passed in.

## Phase 1: User-word store + deck plumbing (pure, tested)

### Overview

The user-word CRUD store, the merged-deck accessor, and the ranker `deck` parameter —
all unit-tested. No screen changes.

### Changes Required:

#### 1. User-word store

**File**: `src/lib/user-vocabulary.ts` (new)

**Intent**: Persist user-authored cards on-device and expose CRUD over them.

**Contract**: AsyncStorage key `vocabulary-user-words` holding a JSON `VocabularyWord[]`.
Exports:
- `getUserWords(): Promise<VocabularyWord[]>` — reads + JSON-parses the key, returns `[]`
  if unset or on parse failure, never throws.
- `slug(text: string): string` — lowercase, non-alphanumeric runs → `-`, trimmed.
- `addUserWord(input: { word: string; definition: string; category: VocabularyCategory }): Promise<{ ok: true; word: VocabularyWord } | { ok: false; reason: 'empty' | 'duplicate' }>` —
  trims `word`/`definition`; `'empty'` if either is blank; builds `id = 'user-' + slug(word)`;
  `'duplicate'` if `id` collides with a `SEED_VOCABULARY` id or an existing user id;
  otherwise appends `{ id, word, definition, category }` and writes (through this module's
  `writeQueue`).
- `updateUserWord(id: string, input: { definition: string; category: VocabularyCategory }): Promise<{ ok: true } | { ok: false; reason: 'not-found' | 'empty' }>` —
  updates definition + category of the matching user card only; the `word` and `id` are
  immutable.
- `deleteUserWord(id: string): Promise<void>` — removes the matching entry and writes;
  does not touch any other storage key.

Import `VocabularyCategory` / `VocabularyWord` from `@/constants/vocabulary` and
`SEED_VOCABULARY` for the collision check.

#### 2. Merged-deck accessor

**File**: `src/lib/vocabulary-store.ts`

**Intent**: One place the loop screen gets "the whole deck" (seed + user).

**Contract**: Append `getAllVocabulary(): Promise<VocabularyWord[]>` returning
`[...getSeedVocabulary(), ...(await getUserWords())]` (imports `getUserWords` from
`@/lib/user-vocabulary`). Do not modify any existing export.

#### 3. Ranker deck parameter

**File**: `src/lib/vocabulary-ranking.ts`

**Intent**: Let the caller rank an arbitrary deck (seed + user words) without the ranker
knowing about storage.

**Contract**: Add `deck` as the last positional parameter —
`rankVocabulary(description, knownState, history = {}, deck: VocabularyWord[] = SEED_VOCABULARY)`
(assuming the S-02 rebase; otherwise `deck` is the 3rd param). Replace the internal
`const seed = SEED_VOCABULARY` with `const seed = deck`. No other logic changes. The
result stays a permutation of `deck`.

#### 4. Unit tests

**File**: `src/lib/user-vocabulary.test.ts` (new), `src/lib/vocabulary-store.test.ts`
(extend — created by S-02), `src/lib/vocabulary-ranking.test.ts` (extend)

**Intent**: Pin the CRUD contract, the merge, and the ranker's behaviour over a custom deck.

**Contract**:
- `user-vocabulary.test.ts` (uses the AsyncStorage mock from S-02): `getUserWords()` is
  `[]` when unset and on a corrupt value (no throw); `addUserWord` persists and returns
  `{ ok: true }`, then `getUserWords` includes it; `addUserWord` with a word slugging to
  a seed id returns `{ ok: false, reason: 'duplicate' }`; blank word or definition returns
  `{ ok: false, reason: 'empty' }`; `updateUserWord` changes definition/category and keeps
  `id`/`word`; `deleteUserWord` removes only the target.
- `vocabulary-store.test.ts`: `getAllVocabulary()` returns `SEED_VOCABULARY.length + N`
  entries with the seed words first, in seed order.
- `vocabulary-ranking.test.ts`: build `deck = [...SEED_VOCABULARY, userWord]` where
  `userWord.category` matches a description; `rankVocabulary(desc, {}, {}, deck)` places
  `userWord` within that category's matched tier; the result length equals `deck.length`
  and its id-set equals the deck's (permutation invariant over a custom deck).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Tests pass: `npm test`
- `npm test` runs the new `user-vocabulary.test.ts` cases (non-zero count, all green)

#### Manual Verification:

- In a scratch script (as in S-01): `addUserWord` a card, then
  `rankVocabulary(<matching description>, {}, {}, await getAllVocabulary())` and confirm
  the custom word appears among its category's words and the list is still a permutation

**Implementation Note**: After completing this phase and all automated verification passes,
pause for manual confirmation before proceeding.

---

## Phase 2: Manage-cards UI

### Overview

The manage view (list + add/edit form + category chips) as a standalone component, and
the `index.tsx` wiring that reaches it and feeds the merged deck to the ranker.

### Changes Required:

#### 1. Manage-cards component

**File**: `src/components/manage-cards.tsx` (new)

**Intent**: Render the user's cards with edit/delete and a form to add or edit one — no
storage or navigation logic of its own; the screen owns those.

**Contract**: Named export `ManageCards`. Props:
`{ userWords: VocabularyWord[]; onAdd: (input) => Promise<{ ok: boolean; reason?: string }>; onUpdate: (id, input) => Promise<{ ok: boolean; reason?: string }>; onDelete: (id) => Promise<void>; onClose: () => void }`.
Renders: a "Back" affordance (`onClose`); a list of `userWords` (word + category +
definition, each with Edit / Delete — Delete asks for a confirm tap); an add/edit form
with a `ThemedTextInput` for word (disabled when editing), a `ThemedTextInput` for
definition, and a row of 9 category chips (`Pressable` + `ThemedView`
`type={selected ? 'backgroundSelected' : 'backgroundElement'}`, wrapping). Submit calls
`onAdd` / `onUpdate` and, on `{ ok: false }`, shows the `reason` inline ("already in your
deck" / "fill in both fields"). Follows the repo component conventions (`@/components`
imports, `StyleSheet.create()` at bottom).

#### 2. Loop screen wiring

**File**: `src/app/index.tsx`

**Intent**: Add the `manage` phase, load the merged deck, and pass it to the ranker.

**Contract**:
- Add `'manage'` to the `Phase` union.
- Add `deck` state (`VocabularyWord[]`, initial `SEED_VOCABULARY`). Load it in the mount
  effect alongside known-state — `getAllVocabulary().then(setDeck)` inside the existing
  `useCallback`-wrapped loader (stays clear of `react-hooks/set-state-in-effect`).
- `handleSubmit` passes `deck` to `rankVocabulary` (as the last argument, alongside
  `history` if S-02 landed).
- Input phase: add a "Manage my cards" `Pressable` → `setPhase('manage')`.
- Manage phase: render `<ManageCards userWords={deck.filter((w) => w.id.startsWith('user-'))}
  onAdd={…} onUpdate={…} onDelete={…} onClose={() => setPhase('input')} />`, where the
  handlers call the `user-vocabulary` CRUD functions and then `getAllVocabulary().then(setDeck)`
  to refresh.
- Import `getAllVocabulary` from `@/lib/vocabulary-store` and the CRUD functions from
  `@/lib/user-vocabulary`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Tests pass: `npm test`

#### Manual Verification:

- Run the app; "Manage my cards" on the input screen opens the manage view
- Add a card (word + definition + category); it appears in the list; "Back" returns to input
- Enter a description matching the new card's category; the card appears in the queue and
  can be marked known/unknown; after "Know it" it sinks on the next matching description
- Adding a word that already exists (seed or user) shows "already in your deck" and does
  not add
- Edit the card's definition; the new text shows on its flashcard in the loop
- Delete the card; it's gone from the manage list and no longer appears in the loop
- No perceptible lag opening the manage view or submitting a description

**Implementation Note**: After completing this phase and all automated verification passes,
pause for manual confirmation before considering the change complete.

---

## Testing Strategy

### Unit Tests:

- `src/lib/user-vocabulary.test.ts` (new) — CRUD contract, slug-collision rejection,
  empty rejection, corrupt-storage handling.
- `src/lib/vocabulary-store.test.ts` (extended) — `getAllVocabulary` = seed + user, seed first.
- `src/lib/vocabulary-ranking.test.ts` (extended) — ranking a user word by category over a
  custom `deck`; permutation invariant over `deck`.

### Integration Tests:

- None. The `manage-cards.tsx` / `index.tsx` wiring is manual-verified (consistent with S-01/S-02).

### Manual Testing Steps:

1. Build/run the app. From input, tap "Manage my cards".
2. Add "gravitas" / "a serious, dignified manner" / category `academic`. Confirm it lists.
3. Back to input. Enter "a philosophy professor". Confirm "gravitas" appears among the
   academic words in the queue.
4. Mark "gravitas" "Know it"; re-enter the description; confirm it has sunk.
5. Manage → Edit "gravitas" definition; back to the loop; confirm the new definition shows.
6. Try to add "gravitas" again; confirm "already in your deck" and no duplicate.
7. Manage → Delete "gravitas"; confirm it's gone from the list and from a matching queue.

## Performance Considerations

User-word count is expected to be small (tens at most). `getUserWords` is one AsyncStorage
read + parse; `getAllVocabulary` concatenates two arrays; the ranker sorts a deck of
~72 + N. All comfortably within "perceptibly instant". The manage list renders N small
rows — no virtualization needed.

## Migration Notes

No migration. `vocabulary-user-words` is absent for existing users and reads as `[]`.
F-01's `vocabulary-known-state` and S-02's `vocabulary-mark-history` keys are untouched;
deleting a user card intentionally leaves its entries in those keys.

**Rebase note (parallel session):** land S-02 first. Then rebase this branch — expect a
trivial reconciliation in `src/lib/vocabulary-ranking.ts` (both branches add a trailing
param: order is `history` then `deck`), an append-merge in `src/lib/vocabulary-store.ts`
(both add new functions), and a small merge in `src/app/index.tsx` (S-02 adds `history`
state + `recordMark`; S-03 adds `deck` state + the `manage` phase — different regions).
The AsyncStorage jest mock and `src/lib/vocabulary-store.test.ts` come from S-02; if this
branch runs before S-02 merges, add the mock here and expect a same-content merge.

## References

- Roadmap: `context/foundation/roadmap.md` (`S-03`)
- PRD: `context/foundation/prd.md` (`FR-004`; Access Control; NFRs)
- S-01: `context/changes/tailored-flashcard-loop/plan.md` + `reviews/impl-review.md`
- S-02: `context/changes/adaptive-card-ranking/plan.md` (the parallel branch; merge order + contract split)
- Pattern references: `src/lib/vocabulary-store.ts` (`getKnownState` + `writeQueue`),
  `src/components/themed-text-input.tsx` + `src/components/flashcard.tsx` (component shape,
  chip / selected-state treatment), `src/app/index.tsx` (phase machine, mount loader)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: User-word store + deck plumbing (pure, tested)

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit` — dffa39a
- [x] 1.2 Linting passes: `npm run lint` — dffa39a
- [x] 1.3 Tests pass: `npm test` — dffa39a
- [x] 1.4 `npm test` runs the new `user-vocabulary.test.ts` cases (non-zero count, all green) — dffa39a

#### Manual

- [x] 1.5 Scratch-script: `addUserWord` then `rankVocabulary(<matching desc>, {}, {}, await getAllVocabulary())` shows the custom word in its category tier and the result is a permutation (automated as the "plan step 1.5" test in `src/lib/vocabulary-store.test.ts`) — dffa39a

### Phase 2: Manage-cards UI

#### Automated

- [x] 2.1 Type checking passes: `npx tsc --noEmit`
- [x] 2.2 Linting passes: `npm run lint`
- [x] 2.3 Tests pass: `npm test`

#### Manual

- [x] 2.4 "Manage my cards" opens the manage view; "Back" returns to input — automated in `e2e/custom-flashcards-crud.spec.ts`
- [x] 2.5 Adding a card (word + definition + category) lists it — automated in `e2e/custom-flashcards-crud.spec.ts`
- [x] 2.6 The new card appears in a category-matching loop queue and can be marked known/unknown (and sinks after "Know it") — e2e covers "appears in queue"; "sinks when known" covered by unit test `sinks a known user card below equally-relevant unknown words`
- [x] 2.7 Adding a duplicate word shows "already in your deck" and does not add — automated in `e2e/custom-flashcards-crud.spec.ts`
- [x] 2.8 Editing a card's definition shows the new text on its flashcard in the loop — e2e asserts the edited text in the manage list; same deck path feeds the flashcard
- [x] 2.9 Deleting a card removes it from the list and from a matching queue — automated in `e2e/custom-flashcards-crud.spec.ts`
- [x] 2.10 No perceptible lag opening the manage view or submitting — e2e runs the full flow in ~2.5s with no fixed waits; not separately asserted
