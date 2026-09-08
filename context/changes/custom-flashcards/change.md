---
change_id: custom-flashcards
title: Custom flashcards — user adds / edits / removes their own word cards that rank alongside the seed deck
status: implementing
created: 2026-09-08
updated: 2026-09-08
archived_at: null
---

## Deviations from plan

- **S-02 not merged.** Implemented on `master` with the plan's documented fallback:
  `rankVocabulary` gains `deck` as the **3rd** positional param (not 4th), and this
  change wires the AsyncStorage jest mock itself (`jest.setup.js` + `setupFiles`).
- **`getUserWords()` propagates, does not swallow.** Mirrors the `getKnownState()`
  hardening done earlier the same day: returns `[]` only for a genuinely-absent key;
  throws `UserWordsReadError` on AsyncStorage rejection, bad JSON, or a non-array shape.
  This keeps `addUserWord`/`updateUserWord`/`deleteUserWord` fail-safe (read-before-write
  rejects before writing) instead of letting a corrupt read overwrite the whole list.
  The Phase 1 test for the corrupt-value case asserts the throw rather than `[]`.

## Notes

Roadmap slice `S-03` in `context/foundation/roadmap.md`. Implements `FR-004` ("User can
add new flashcards manually", nice-to-have, un-parked). Builds on `S-01`
(`tailored-flashcard-loop`). On-device only, no network.

Parallel-session note (M2L5): developed alongside `S-02` (`adaptive-card-ranking`).
Agreed contract split to keep merges trivial — S-03 adds a *new* `getAllVocabulary()`
(seed + user words) to `src/lib/vocabulary-store.ts` and leaves `getSeedVocabulary()` /
`getKnownState()` untouched; it does not change the `rankVocabulary` signature (S-02 owns
that). User words persist under a new AsyncStorage key, separate from F-01's
`vocabulary-known-state`. Recommended merge order: S-02 first, then S-03 rebases the
`src/app/index.tsx` overlap once.
