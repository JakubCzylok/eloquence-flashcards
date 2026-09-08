---
change_id: custom-flashcards
title: Custom flashcards — user adds / edits / removes their own word cards that rank alongside the seed deck
status: planned
created: 2026-09-08
updated: 2026-09-08
archived_at: null
---

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
