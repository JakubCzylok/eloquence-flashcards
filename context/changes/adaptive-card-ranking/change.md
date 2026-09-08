---
change_id: adaptive-card-ranking
title: Adaptive card ranking — weight the matcher by known/unknown history over sessions
status: planned
created: 2026-09-08
updated: 2026-09-08
archived_at: null
---

## Notes

Roadmap slice `S-02` in `context/foundation/roadmap.md`. Covers the PRD's Secondary
Success Criterion ("Cards adapt over time — the app gets better at picking relevant words
as the user marks more known/unknown"). Builds on `S-01` (`tailored-flashcard-loop`),
which deliberately confined all ranking to the pure `rankVocabulary()` function and left
this as a seam to extend.

Parallel-session note (M2L5): developed alongside `S-03` (`custom-flashcards`). Agreed
contract split to keep merges trivial — S-02 owns any `rankVocabulary` signature change
and adds *new* functions to `src/lib/vocabulary-store.ts` (e.g. mark-history read/write
under a new AsyncStorage key); it does not modify `getSeedVocabulary()` or `getKnownState()`.
