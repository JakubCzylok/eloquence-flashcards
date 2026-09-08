---
change_id: seed-vocabulary-and-local-storage
title: On-device vocabulary store (seed dataset + known/unknown persistence)
status: impl_reviewed
created: 2026-08-25
updated: 2026-09-08
archived_at: null
---

## Notes

Roadmap item `F-01` in `context/foundation/roadmap.md`. Foundation that unlocks `S-01` (tailored-flashcard-loop) — the north star slice. Minimal on-device word store: seed vocabulary dataset (word + definition + category) plus AsyncStorage-backed known/unknown persistence. Scope explicitly excludes the matching/ranking algorithm, which lives in `S-01`.

## Deviation from plan.md (Phase 2)

`plan.md`'s Phase 2 contract says the debug screen has "no entry added to `AppTabs`". During manual verification this proved unreachable: the root layout's tab navigators (`expo-router/ui`'s `<Tabs>` in `app-tabs.web.tsx`, `expo-router/unstable-native-tabs`'s `<NativeTabs>` in `app-tabs.tsx`) each declare a closed set of triggers ("home", "explore") and don't expose sibling file routes via direct URL navigation. Fix (user-approved): added a temporary third trigger ("Debug" → `/debug-vocabulary`) to both tab files, clearly commented as temporary. Remove this trigger alongside `src/app/debug-vocabulary.tsx` per the plan's existing Migration Notes.

### UI shape deviation

`plan.md`'s Phase 2 contract describes a flat list ("render the full seed list with each word's category and current known/unknown status", "tap any word to toggle its state"). The implemented screen (`src/app/debug-vocabulary.tsx`) instead uses a `react-native-reanimated` 3D flip card per row — front shows word + category, back (tap to flip) shows the definition — plus separate ✓/✗ controls that set known/unknown as an explicit tri-state (`undefined` / `true` / `false`) rather than a single toggle. `react-native-reanimated` and `react-native-safe-area-context` were already project dependencies, so no new packages were added. This is a throwaway verification screen slated for deletion with `S-01`, so the extra UI is accepted as-is. Note for anyone re-verifying: manual criterion 2.3 (word + definition + category visible per word) requires flipping each card, since the definition is on the back face.
