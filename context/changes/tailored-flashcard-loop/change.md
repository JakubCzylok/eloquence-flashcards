---
change_id: tailored-flashcard-loop
title: Tailored flashcard loop (description → ranked card → mark known/unknown → next)
status: implemented
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
