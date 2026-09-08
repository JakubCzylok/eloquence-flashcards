# Custom flashcards — Plan Brief

> Full plan: `context/changes/custom-flashcards/plan.md`

## What & Why

Roadmap slice `S-03`, implementing `FR-004` (un-parked). Let the user add their own
vocabulary cards — word, definition, one of the 9 categories — from inside the app. They
persist on-device, rank against descriptions through the same `rankVocabulary()` as seed
words, and carry their own known/unknown state. The user can also edit a card's
definition/category and delete a card.

## Starting Point

S-01 (`tailored-flashcard-loop`) shipped: `VocabularyWord = { id, word, definition,
category }` with a closed 9-value `VocabularyCategory` union; a pure `rankVocabulary` that
iterates its deck generically off an internal `SEED_VOCABULARY`; `getKnownState` /
`setWordKnownState` keyed by arbitrary `id`; a single-screen `phase` state machine in
`index.tsx`. No navigation stack, no picker component, no AsyncStorage test mock on
`master`. S-02 (`adaptive-card-ranking`) is the parallel branch and **merges first**.

## Desired End State

From the loop's input screen, "Manage my cards" opens a manage view: a list of the user's
cards (edit / delete each) and a form to add one (word, definition, category chips).
Added cards show in the list and rank in the normal loop among their category's words;
they can be marked known/unknown and sink when known. Editing changes definition +
category (not the word); deleting removes the card from the deck (its known-state /
history entries stay, harmless). All on-device; `rankVocabulary()` stays pure.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| User words → ranker | Optional `deck` param on `rankVocabulary` (4th, after S-02's `history`) | Keeps the ranker pure and storage-agnostic; same pattern S-02 uses |
| Manage UI location | A new `manage` phase in the existing state machine | No navigation stack (S-01 avoided one); consistent, one screen |
| Data model | Reuse `VocabularyWord`, id = `user-<slug>` | Zero type/ranker/test churn; the `user-` prefix prevents collisions and identifies user cards |
| Category | Force a pick from the existing 9 (inline chips) | Union stays closed, user words rank exactly like seed words, no picker dependency |
| CRUD scope | Full — add, edit, delete | The roadmap outcome is "add / edit / remove"; store fns are symmetric |
| Edit scope | Definition + category only; word (and id) immutable | Changing the word = delete + re-add, so id and known-state stay coherent |
| Validation | Trim; require word + definition; reject slug collisions | Prevents the id collisions the id scheme is exposed to; stops accidental dupes |
| Delete + orphans | Leave known-state / mark-history entries | Consistent with "never delete known-state"; re-adding recovers progress |
| Testing | Unit-test store CRUD + merge + ranker-over-deck; no UI tests | The store/merge is the risk surface; matches S-01/S-02 posture |
| AsyncStorage mock | Comes from S-02's rebase (S-02 merges first) | No duplicated planning; honours the agreed merge order |

## Scope

**In scope:**
- `src/lib/user-vocabulary.ts` — `getUserWords`, `slug`, `addUserWord`, `updateUserWord`, `deleteUserWord` (key `vocabulary-user-words`)
- `getAllVocabulary()` appended to `src/lib/vocabulary-store.ts`
- `deck` param on `rankVocabulary`
- `src/components/manage-cards.tsx` — list + add/edit form + 9 category chips
- `src/app/index.tsx` — `manage` phase, `deck` state + load, "Manage my cards" button
- Unit tests: `user-vocabulary.test.ts`, extended `vocabulary-store.test.ts` + `vocabulary-ranking.test.ts`

**Out of scope:**
- Any change to `getSeedVocabulary` / `getKnownState` / `setWordKnownState` or `vocabulary.ts`
- A `source` field, a new category value, optional category
- Editing a card's word; cleaning up known-state/history on delete
- Navigation stack / new route / new tab; picker dependency
- Component / integration tests; migration (additive key)

## Architecture / Approach

`user-vocabulary.ts` owns a JSON `VocabularyWord[]` under a new key with its own
serialized write queue. `getAllVocabulary()` = seed ++ user words. `rankVocabulary` gains
a trailing `deck` param (default `SEED_VOCABULARY`) and ranks whatever deck it's handed —
the four-pass logic is already deck-generic, so custom words bucket by category like any
seed word. The manage UI is a self-contained `ManageCards` component (list + form +
chips) driven by callbacks; `index.tsx` adds a fourth `phase`, loads the merged deck once
on mount, and passes it to the ranker. Phase 1 = plumbing + tests, Phase 2 = the UI.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. User-word store + deck plumbing (pure, tested) | `user-vocabulary.ts` CRUD, `getAllVocabulary`, ranker `deck` param, unit tests | Slug/collision logic; depends on S-02's AsyncStorage mock via rebase |
| 2. Manage-cards UI | `manage-cards.tsx` + `index.tsx` wiring (manage phase, deck load, button) | `index.tsx` merge with S-02 (different regions, but same file); building a form + chip picker with no picker dep |

**Prerequisites:** S-01 merged; **S-02 merged first**, then rebase this branch.
**Estimated effort:** ~2 focused sessions; Phase 2 (the form UI) is the larger half.

## Open Risks & Assumptions

- Assumes S-02 has merged so the AsyncStorage mock, `vocabulary-store.test.ts`, and the
  `history` param exist. If not, this branch adds the mock and expects a same-content merge.
- The `index.tsx` merge with S-02 touches one file from two branches; regions differ
  (`history`/`recordMark` vs `deck`/`manage` phase) so conflicts should be small.
- A hand-rolled 9-chip category selector is simple but untested visually until Phase 2's
  manual pass; acceptable for MVP.

## Success Criteria (Summary)

- The user can add a card, see it rank in a category-matching loop queue, mark it
  known/unknown, edit its definition, and delete it — all on-device.
- Duplicate words are rejected with a clear message; `rankVocabulary` stays a pure
  permutation over whatever deck it's given.
- `npm test` (new store tests + extended ranker/merge tests), `npx tsc --noEmit`, and
  `npm run lint` all pass.
