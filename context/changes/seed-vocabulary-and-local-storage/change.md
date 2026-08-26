---
change_id: seed-vocabulary-and-local-storage
title: On-device vocabulary store (seed dataset + known/unknown persistence)
status: implementing
created: 2026-08-25
updated: 2026-08-25
archived_at: null
---

## Notes

Roadmap item `F-01` in `context/foundation/roadmap.md`. Foundation that unlocks `S-01` (tailored-flashcard-loop) — the north star slice. Minimal on-device word store: seed vocabulary dataset (word + definition + category) plus AsyncStorage-backed known/unknown persistence. Scope explicitly excludes the matching/ranking algorithm, which lives in `S-01`.

## Deviation from plan.md (Phase 2)

`plan.md`'s Phase 2 contract says the debug screen has "no entry added to `AppTabs`". During manual verification this proved unreachable: the root layout's tab navigators (`expo-router/ui`'s `<Tabs>` in `app-tabs.web.tsx`, `expo-router/unstable-native-tabs`'s `<NativeTabs>` in `app-tabs.tsx`) each declare a closed set of triggers ("home", "explore") and don't expose sibling file routes via direct URL navigation. Fix (user-approved): added a temporary third trigger ("Debug" → `/debug-vocabulary`) to both tab files, clearly commented as temporary. Remove this trigger alongside `src/app/debug-vocabulary.tsx` per the plan's existing Migration Notes.
