---
change_id: tailored-flashcard-loop
title: Tailored flashcard loop (description → ranked card → mark known/unknown → next)
status: impl_reviewed
created: 2026-09-08
updated: 2026-09-08
archived_at: null
---

## Notes

Roadmap slice `S-01` in `context/foundation/roadmap.md` — the north-star slice: the one
end-to-end flow the PRD's Primary Success Criterion hinges on (US-01, FR-001, FR-002,
FR-003). Builds directly on `F-01` (`seed-vocabulary-and-local-storage`), which shipped
`getSeedVocabulary()` / `getKnownState()` / `setWordKnownState()`.

User types a free-text description of the person/interests they're about to talk to →
app ranks the seed vocabulary against it with a rule-based (no-ML) matcher → shows the
top card (word + definition) → user marks known/unknown → next card. On-device only, no
network, perceptibly instant.

Plan: `context/changes/tailored-flashcard-loop/plan.md`
Brief: `context/changes/tailored-flashcard-loop/plan-brief.md`

## Deviations from plan.md (recorded during implementation + impl-review)

- **Test-runner peer skew.** `jest-expo@57.0.5` peer-depends on
  `@react-native/jest-preset@^0.86.3` but the project pins `react-native@0.86.2`.
  Resolution (user-approved): added `.npmrc` with `legacy-peer-deps=true` and
  installed `@react-native/jest-preset@0.86.3` explicitly. `.npmrc` loosens peer
  resolution repo-wide for all future installs — revisit when Expo SDK / RN
  versions realign.
- **`getSeedVocabulary()` is not re-exported from `@/constants/vocabulary`.** The
  plan's ranker contract referenced it; it actually lives in
  `@/lib/vocabulary-store` (and would drag AsyncStorage into unit tests). The
  ranker and its tests import `SEED_VOCABULARY` directly from
  `@/constants/vocabulary`, keeping `rankVocabulary()` genuinely pure.
- **Test globals via `@jest/globals` import**, not a tsconfig `types: ["jest"]`
  change — same result, no global-scope change repo-wide.
- **`ThemedTextInput` exposes `themeColor?: ThemeColor`**, not the plan's
  `lightColor`/`darkColor`. This matches `themed-text.tsx` (the working pattern);
  `themed-view.tsx`'s `lightColor`/`darkColor` props are declared but never read.
- **`"test"` script is `jest`** (one-shot, for the CI/gate use the plan's
  Automated Verification assumes), not the Expo guide's `jest --watchAll`.

## Impl-review outcome (2026-09-08)

Full-plan review: **APPROVED** (1 minor warning, 5 observations). F1 (`multiline`
on the description input, contradicting the plan) fixed — dropped `multiline`,
restoring Return-to-submit. F2 (no keyboard avoidance) fixed — wrapped the screen
in `KeyboardAvoidingView`. F3 (double-tap race in `handleMark`) fixed —
re-entrancy guard. F4 recorded above. F5 (`.npmrc` repo-wide) recorded above. F6
(vacuous test sub-assertion) — see review. Report:
`context/changes/tailored-flashcard-loop/reviews/impl-review.md`.
