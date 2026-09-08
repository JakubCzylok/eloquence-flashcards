# Tailored flashcard loop — Plan Brief

> Full plan: `context/changes/tailored-flashcard-loop/plan.md`

## What & Why

Roadmap slice `S-01` — the north-star flow the PRD's Primary Success Criterion hinges on.
The user types a free-text description of the person / interests they're about to talk to;
the app ranks the F-01 seed vocabulary against it with a rule-based (no-ML) matcher; shows
the most relevant card (word + definition); the user marks it known/unknown and sees the
next. On-device, no network, perceptibly instant. This is what makes Eloquence Flashcards
different from a generic deck app: the card is *ranked from the description*, never random.

## Starting Point

F-01 (`seed-vocabulary-and-local-storage`) is merged and provides the whole data layer:
`getSeedVocabulary()` (72 words, 9 categories), `getKnownState()`, `setWordKnownState()`.
`src/app/index.tsx` is still the Expo template welcome screen. There is no navigation
stack — `_layout.tsx` renders `<AppTabs/>` directly. No `TextInput` and no test runner
exist in the repo yet. F-01 left a throwaway `debug-vocabulary` screen + temporary "Debug"
tab triggers that its own review flagged for removal once a real UI exists.

## Desired End State

The app opens on the loop screen (home tab): a description input, then ranked cards shown
one at a time with "Know it" / "Don't know it" buttons, a persistent "New description"
escape hatch, and a terminal "reviewed every word" state. Gibberish input still yields
cards (no dead-ends). A pure, unit-tested `rankVocabulary(description, knownState)` lives
in `src/lib/`. The F-01 debug screen and its tab triggers are deleted.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Matching rule | Keyword→category lexicon; score 9 categories by keyword hits | Produces obviously-relevant cards for a demo, tunable, cheap; no ML per PRD Non-Goals | Plan |
| Multi-topic input | Multi-category, weighted round-robin interleave | Real descriptions span several interests ("history professor who races bikes") | Plan |
| Ordering / tiebreak | Score desc → not-known before known → stable seed order | Best cards first, avoids repeats, fully deterministic (testable) | Plan |
| Queue lifecycle | Rank once on submit; advance an index; skip known-on-pop, no re-rank | Perceptibly instant, order never shifts under the user | Plan |
| Known-state effect | Known words sink to the bottom, still reachable | Consistent with F-01's "deprioritized, never deleted" decision | Plan / F-01 |
| Edge / exhausted | Always show something; terminal "start new" state; no submit-blocking | PRD Primary criterion: "no crashes/dead-ends"; avoid pre-conversation friction | Plan |
| Navigation | One screen, internal `phase` state, on the home tab | No stack exists today; adding Stack+Tabs nesting risks routing bugs on the key slice | Plan |
| Card reveal | Word + definition shown together | It's a "give me an opener" tool, not a memory drill; FR-002 says "word + definition" | Plan |
| Description persistence | In-memory only, never written to disk | Simplest; most conservative reading of "no description leaves the device" | Plan |
| Re-input | Persistent "New description" button on the card screen | One obvious escape hatch for a mistyped description | Plan |
| Adaptation scope | Minimal — only known-state deprioritization | Covers the Secondary criterion's spirit; keeps S-01 on its actual PRD refs | Plan |
| Testing | Add `jest-expo`; unit-test `rankVocabulary()` only; UI manual | The ranker is pure, deterministic, highest-risk; the old deadline has passed | Plan |
| Debug cleanup | Delete `debug-vocabulary.tsx` + both temporary tab triggers | F-01's impl-review + Migration Notes asked for exactly this once a real UI exists | Plan / F-01 |

## Scope

**In scope:**
- `src/constants/category-keywords.ts` — keyword→category lexicon
- `src/lib/vocabulary-ranking.ts` — pure `rankVocabulary()` + `src/lib/vocabulary-ranking.test.ts`
- `jest-expo` test runner setup (`package.json`, jest config)
- `src/app/index.tsx` — replaced with the phase-state loop
- `src/components/flashcard.tsx`, `src/components/themed-text-input.tsx` — new
- Delete `src/app/debug-vocabulary.tsx`; remove temporary "Debug" triggers from both `app-tabs` files

**Out of scope:**
- Any ML / trained matcher (PRD Non-Goals)
- Cross-session adaptive ranking beyond "known sinks"
- Navigation stack / multi-route flow
- Persisting the description to disk
- Changes to `explore.tsx` or the home tab label
- FR-004 "add flashcard" UI (Parked)
- Component / integration / e2e tests

## Architecture / Approach

`rankVocabulary(description, knownState)` is a pure function returning all 72 words in
display order (a permutation — every word once), so the same call serves both the ranked
result and the "no dead-ends" fallback. The loop screen holds that array plus an index:
advance on mark, show the terminal state at the end. Known-state is loaded once on mount
(via F-01's `getKnownState`), used as the ranking snapshot, and written through F-01's
`setWordKnownState` on each mark. Three phases: (1) ranker + lexicon + tests, no UI;
(2) the loop screen + two presentational components; (3) delete the F-01 debug surface.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Ranking logic + lexicon (pure, tested) | `CATEGORY_KEYWORDS`, `rankVocabulary()`, `jest-expo` + unit tests | Lexicon quality / coverage — needs a human skim; first jest-expo wiring in the repo |
| 2. The loop screen | `index.tsx` replaced with input → card → mark → next → done; `Flashcard` + `ThemedTextInput` | `react-hooks/set-state-in-effect` under reactCompiler; first `TextInput` in the repo |
| 3. Remove F-01 debug surface | Delete `debug-vocabulary.tsx` + both temporary tab triggers | typedRoutes referencing the deleted screen if not removed cleanly |

**Prerequisites:** F-01 merged (done). Commit F-01's post-review working-tree fixes
(`use-color-scheme.web.ts`, `vocabulary-store.ts`) first so `lint` / `tsc` start green.
**Estimated effort:** ~2–3 focused sessions across the three phases; the dominant cost in
Phase 1 is authoring and skimming the keyword lexicon, not the code.

## Open Risks & Assumptions

- The keyword lexicon is LLM-authored, not usage-tuned — relevance quality for real
  descriptions is unproven until manually exercised (Phase 1 manual check + Phase 2 use).
- `jest-expo` wiring for SDK 57 is assumed to follow the current Expo Unit Testing guide;
  the plan mandates reading `docs.expo.dev/versions/v57.0.0` before editing (AGENTS.md rule).
- Coarse 9-category matching may feel blunt for very specific descriptions; accepted for
  the MVP — deeper matching is a later slice.

## Success Criteria (Summary)

- User completes input → tailored card → mark known/unknown → next, end to end, with no
  crashes or dead-ends, and no perceptible lag after submit.
- A multi-topic description visibly surfaces cards from more than one interest; a
  known-marked word is deprioritized on the next description.
- `npm test` (ranking unit tests), `npx tsc --noEmit`, and `npm run lint` all pass; the
  F-01 debug screen and tab triggers are gone.
