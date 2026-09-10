---
project: "Eloquence Flashcards"
version: 1
status: draft
created: 2026-08-25
updated: 2026-09-08
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Eloquence Flashcards

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Young adults freeze up when talking to people who feel more educated or articulate, and rather than risk fumbling for an opening they opt out of the conversation entirely. Eloquence Flashcards closes the specific, recurring gap — how to start — with short, spaced flashcard practice instead of long-form eloquence study. The product's wedge — the one trait that, if removed, makes this indistinguishable from a generic flashcard app — is that each card is ranked from a free-text description of the person and situation the user is about to face, never drawn randomly or sequentially from a deck.

## North star

**S-01: User completes the tailored-flashcard loop end-to-end** — the PRD has exactly one user story, and its Primary Success Criterion describes this same loop verbatim; there is no smaller or different slice that would validate the product's core hypothesis.

> "North star" here means the smallest end-to-end slice whose successful delivery proves the core idea works — everything else in the roadmap only matters if this one does. It is placed first because Prerequisites allow it and because `main_goal: speed` biases toward shipping the must-have path before anything else.

## At a glance

| ID   | Change ID                        | Outcome (user can …)                                                          | Prerequisites | PRD refs                    | Status   |
| ---- | --------------------------------- | ------------------------------------------------------------------------------ | -------------- | ---------------------------- | -------- |
| F-01 | seed-vocabulary-and-local-storage | (foundation) on-device word store: seed vocabulary dataset + known/unknown state | —              | Business Logic, NFRs         | done     |
| S-01 | tailored-flashcard-loop           | input a description and complete the description → card → mark loop           | F-01           | US-01, FR-001, FR-002, FR-003 | done     |
| S-02 | adaptive-card-ranking             | see the ranking improve over sessions — struggled words rise, known words sink | S-01           | Success Criteria (Secondary), Business Logic | planned  |
| S-03 | custom-flashcards                 | add / edit / remove their own word cards that then rank alongside the seed deck | S-01           | FR-004                       | done     |
| F-02 | auth                              | (foundation) sign in with email + password; known-state and cards move to per-user Supabase tables with RLS | S-01, S-03     | Access Control, NFRs         | done     |
| S-04 | words-progress-view              | open a review view listing words split into known / still-learning / not-yet-reviewed | S-01 (after S-02, S-03) | — (supports the Secondary criterion's visibility) | proposed |

## Baseline

What's already in place in the codebase as of `2026-08-25` (auto-probed + user-confirmed). Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** partial — Expo Router scaffold present (`src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/explore.tsx` are the default template screens; `expo-router` and `react-native-web` are in `package.json`), but zero app-specific screens or components exist yet.
- **Backend / API:** absent — architecturally excluded, not a gap. PRD requires on-device-only operation with no network calls (`## Non-Functional Requirements`, `## Access Control`).
- **Data:** absent — no persistence library in `package.json` (no AsyncStorage/SQLite/MMKV), no vocabulary dataset or data model anywhere in the repo.
- **Auth:** absent at baseline — the PRD originally excluded it ("Single user; no auth; data lives on-device only"). _Added later in change `F-02 / auth` once the 10xBuilder authentication requirement made it necessary — see Done._
- **Deploy / infra:** partial — EAS is configured and verified this session (`eas.json` present; first Android preview build finished successfully — see `context/deployment/deploy-plan.md`). A public GitHub repo exists (https://github.com/JakubCzylok/eloquence-flashcards) but no CI/CD workflow is wired.
- **Observability:** absent — no crash reporting or logging library. Explicitly out of scope for MVP per `context/foundation/infrastructure.md`.

## Foundations

### F-01: On-device vocabulary store

- **Outcome:** (foundation) a minimal local persistence mechanism holds a seed vocabulary dataset (word + definition + topic/interest tags) and per-word known/unknown state, entirely on-device.
- **Change ID:** seed-vocabulary-and-local-storage
- **PRD refs:** Business Logic (word ranked against "the deck"), Non-Functional Requirements ("fully usable with no network connection", "no description... leaves the device"), Access Control ("data lives on-device only")
- **Unlocks:** S-01 (needs a deck to rank against and somewhere to persist known/unknown state)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - How large/curated the initial seed word list needs to be (topic coverage, count) — Owner: user/team. Block: no. A small curated list is enough to make S-01 demonstrable; it can grow later without changing the storage shape.
- **Risk:** Sequenced first because S-01 cannot be built or verified without both a deck to rank against and a place to persist known/unknown — deferring this would make S-01 unplannable, not just incomplete.
- **Status:** ready

## Slices

### S-01: Tailored flashcard loop

- **Outcome:** user types a short description of the person/interests they're about to talk to, sees a flashcard (word + definition) ranked as most relevant to that description, marks it known/unknown, and immediately sees the next relevant card — no login, no network dependency, no noticeable lag.
- **Change ID:** tailored-flashcard-loop
- **PRD refs:** US-01, FR-001, FR-002, FR-003, Non-Functional Requirements ("perceptibly instant response", "fully usable with no network connection", "no description... leaves the device")
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the one flow the PRD's Primary Success Criterion hinges on — with 2 days left before the hard deadline, anything built before this is verified end-to-end risks leaving no time for a demonstrable product.
- **Status:** in progress

### S-02: Adaptive card ranking

- **Outcome:** across repeated sessions the app surfaces words the user has struggled with (repeatedly marked unknown) higher, and words they reliably know lower, so the ranking measurably improves at picking relevant, useful words as marking history accumulates — with no manual tuning.
- **Change ID:** adaptive-card-ranking
- **PRD refs:** Success Criteria → Secondary ("Cards adapt over time — the app gets better at picking relevant words as the user marks more known/unknown"), Business Logic
- **Prerequisites:** S-01 (extends the loop and the `rankVocabulary()` seam), F-01 (persistence)
- **Parallel with:** S-03 (independent surfaces — ranking weights vs. deck authoring)
- **Blockers:** —
- **Unknowns:**
  - What signal to persist and how it decays — raw unknown-count, a recency-weighted score, or a simple "struggled" flag. Owner: user/team. Block: no — S-01 confines ranking to one pure function, so the shape is a `/10x-plan` decision, not a loop rework.
  - Whether adaptation is global or scoped per description/category. Owner: user/team. Block: no.
- **Risk:** Low structural risk — S-01 deliberately isolated all ranking logic in one pure function (`rankVocabulary()`) and one storage key, so this slice extends a seam rather than reworking the loop. The real risk is product-shaped: an adaptation rule that feels arbitrary is worse than none, so it needs a concrete, explainable weighting.
- **Status:** proposed

### S-03: Add your own flashcards

- **Outcome:** the user can add a vocabulary card of their own (word, definition, category) from within the app; it immediately joins the deck, is ranked against descriptions alongside the seed words, and carries its own known/unknown state. They can also edit or remove a card they added.
- **Change ID:** custom-flashcards
- **PRD refs:** FR-004 ("User can add new flashcards manually", nice-to-have), Access Control ("data lives on-device only"), Non-Functional Requirements ("fully usable with no network connection")
- **Prerequisites:** S-01 (the loop and deck-consumption path), F-01 (persistence — needs a second key or an extended shape for user-authored words)
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:**
  - Storage shape for user words — a separate AsyncStorage key merged with `SEED_VOCABULARY` at read time, vs. one combined store. Owner: user/team. Block: no.
  - Whether user words require a category, or get an "uncategorised" bucket the ranker treats as always-eligible. Owner: user/team. Block: no.
  - Whether edit/delete is in this slice or a follow-up. Owner: user/team. Block: no.
- **Risk:** FR-004 is explicitly nice-to-have and the PRD says revisit "after the MVP validates the curated deck" — so this slice must not precede real usage of S-01. Sequenced after, risk is contained: it is additive to the deck-read path and changes no matching logic.
- **Status:** planned

### S-04: Words progress view

- **Outcome:** from the loop's input screen the user opens a read-only review view that lists the vocabulary split into "Known" (marked known), "Still learning" (marked unknown), and "Not reviewed yet" (never marked), so they can see what they have covered. Once S-03 has landed, user-authored cards appear in the same lists.
- **Change ID:** words-progress-view
- **PRD refs:** none directly — no FR mandates it. Supports the spirit of the Secondary Success Criterion (visible sense that the deck is adapting) and general retention/motivation.
- **Prerequisites:** S-01 (the loop screen + `getKnownState()`). **Sequenced after S-02 and S-03**, not because of a logic dependency but because all three add a new `phase` + entry button to `src/app/index.tsx` — stacking a third one on `master` while S-02/S-03 are unmerged on branches would force extra `index.tsx` rebase conflicts on both.
- **Parallel with:** — (sequenced after S-02/S-03)
- **Blockers:** —
- **Unknowns:**
  - Whether "Not reviewed yet" is a useful third bucket or just noise at 72 words. Owner: user/team. Block: no.
  - Whether the view is purely read-only or also lets the user re-mark a word from the list. Owner: user/team. Block: no — read-only is the smaller starting point.
- **Risk:** Low — a read-only view over data that already exists (`getKnownState()` + `getSeedVocabulary()` / `getAllVocabulary()`), no new storage, no new dependency, no change to the matcher. Main cost is the list UI.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                        | Suggested issue title                                                      | Ready for `/10x-plan` | Notes                                       |
| ---------- | --------------------------------- | ---------------------------------------------------------------------------- | ---------------------- | -------------------------------------------- |
| F-01       | seed-vocabulary-and-local-storage | Set up on-device vocabulary store (seed dataset + known/unknown persistence) | done                   | Merged; impl-reviewed                        |
| S-01       | tailored-flashcard-loop           | Build the tailored flashcard loop (input → matched card → mark known/unknown) | done                   | Implemented + impl-reviewed (2026-09-08)     |
| S-02       | adaptive-card-ranking             | Make the ranking adapt to known/unknown history over sessions               | yes                    | Planned; worktree `feat/adaptive-card-ranking`; merges before S-03 |
| S-03       | custom-flashcards                 | Let the user add / edit / remove their own flashcards                        | yes                    | Planned; worktree `feat/custom-flashcards`; rebases onto S-02 |
| S-04       | words-progress-view              | Review view: words split into known / still-learning / not-yet-reviewed      | no                     | Blocked behind S-02 + S-03 landing (shared `index.tsx` surface); run `/10x-plan words-progress-view` then |

## Open Roadmap Questions

1. **Should cloud sync / multi-device support ever be in scope?** — Owner: user. Block: roadmap-wide (none currently; deferred). *(from PRD Open Questions #1)*
2. **Should a spaced-repetition scheduling algorithm be added beyond known/unknown marking?** — Owner: user. Block: roadmap-wide (none currently; deferred). *(PRD Open Questions #2)*
3. **What accessibility standard (if any) should the app target?** — Owner: user. Block: roadmap-wide (none currently; deferred). *(PRD Open Questions #3)*

## Parked

- **No custom-trained NLP/matching model** — Why parked: PRD Non-Goals; avoids heavy ML scope inside the 1.5-week timeline. Simple rule-based matching against tagged seed words is sufficient for FR-002.
- **FR-004: User can add new flashcards manually (nice-to-have)** — Un-parked 2026-09-08: promoted to slice **S-03 (`custom-flashcards`)**, sequenced after S-01 per the PRD's "revisit after the MVP validates the curated deck" note. Still not started.
- **iOS build** — Why parked: `infrastructure.md`'s "Getting Started" recommends one platform first; the Android preview build is already configured and verified this session (see `deploy-plan.md`). iOS additionally requires an Apple Developer Program account not yet set up.
- **GitHub Actions CI / auto-deploy-on-merge** — Why parked: `infrastructure.md`'s risk register recommends manual/on-demand EAS builds during active iteration to avoid burning the free-tier build allowance; revisit after S-01 is verified.
- **`eas submit` (App Store / Play Store submission)** — Why parked: requires human account-level authorization and only makes sense after S-01 is built and manually verified on-device.
- **EAS Update / OTA setup** — Why parked: not needed until there's a shipped native build to push JS/asset updates to.
- **Crash reporting (Sentry)** — Why parked: `infrastructure.md` notes it isn't bundled with EAS; explicitly deferred to post-MVP.

## Done

- **F-01: On-device vocabulary store** (`seed-vocabulary-and-local-storage`) — implemented and impl-reviewed (2026-09-08). Ships `getSeedVocabulary()` / `getKnownState()` / `setWordKnownState()` over AsyncStorage; 72-word seed deck across 9 categories.
- **S-01: Tailored flashcard loop** (`tailored-flashcard-loop`) — implemented and impl-reviewed (2026-09-08). The description → ranked card → mark known/unknown → next loop; pure rule-based `rankVocabulary()`; replaced the template home screen; F-01 debug surface removed. `jest-expo` test runner introduced.
- **S-03: Custom flashcards** (`custom-flashcards`) — implemented (2026-09-10, `dffa39a` / `11e3763`). Add / edit / delete user-authored cards from a "Manage my cards" view; they rank alongside the seed deck via a new `deck` parameter on `rankVocabulary`. Gave the app a full CRUD surface (the 10xBuilder CRUD requirement).
- **F-02: Auth + per-user data** (`auth`) — implemented (2026-09-10). Supabase Auth (email + password) behind a login gate on the whole app; `known_state` and `user_words` moved to per-user Postgres tables with row-level security, backed by a local read cache for offline reads; one-shot first-login adoption of pre-auth on-device data. Meets the 10xBuilder authentication requirement. Leftover Expo template chrome (tab bar, Explore screen) removed at the same time.

