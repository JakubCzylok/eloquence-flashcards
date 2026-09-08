# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-08 (Phase 1 implementing; §1/§2/§4/§5 revised after user review — git-history de-weighted, test-base reframed as greenfield, R2 likelihood raised to High, R7 description-privacy risk added, quality gates trimmed for a solo project)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the ground
   truth.

Hot-spot scope used for likelihood weighting: `src/` (`src/app`,
`src/components`, `src/constants`, `src/hooks`, `src/lib`), excluding tests
and build output. **Git history was not a useful likelihood signal this
pass**: 8 commits/30d, all from the current session's own F-01 + S-01 work,
and the top churned directory (`src/components`) is almost entirely the
debug-tab being added and then removed in `app-tabs.tsx` — noise that is
now settled. Likelihood in §2 is therefore driven by the **roadmap** (S-02
and S-03 both about to modify the ranker and storage) and the **Phase 2
interview**, not by churn. Re-run the hot-spot scan at `--refresh` once the
history reflects real ongoing authoring.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario — user/business terms) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | The user types a description and the card they get is not relevant to that person or context — the ranked-not-random match is the whole product, so an off-topic card makes the app no better than a generic deck | High | High | PRD Business Logic + US-01 + FR-002; interview Q1 (top worry) + Q3 (low-confidence area); roadmap S-02 and S-03 both modify the ranker |
| 2 | The same description gives a different card order on different runs, or the loop shows a word twice / skips one entirely / never reaches its end screen | High | High | S-01 plan Critical Implementation Details ("pure, deterministic", "permutation of the deck") — invariant tested only for today's argument form; interview Q3; roadmap S-02 (adds a struggle-weight tier) + S-03 (adds a deck parameter) — three independent changes to the same sort |
| 3 | On launch the app shows a blank screen, or the user's accumulated known/unknown history is silently gone, because a stored value is corrupt or from an older version | High | Medium | interview Q1 (alt) + Q4 (scariest untested gap); F-01 plan (the "never throws, returns {}" read contract has no test); roadmap S-02 adds a second storage key with the same read pattern |
| 4 | The user marks several cards quickly and one of the marks does not stick — after the next launch that word is still unmarked | Medium | Medium | F-01 impl-review finding F3 (the race a serialized write path was added to fix); roadmap S-02 (a second writer shares that path); interview Q4 |
| 5 | The loop shows a blank card or freezes with no way back to the input screen — e.g. after the last card, on a description that matches nothing, or on a screen a later feature added | High | Medium | PRD Primary Success Criterion ("no crashes/dead-ends"); S-01 plan (fallback + terminal state); roadmap S-02/S-03/S-04 each add a phase to the loop |
| 6 | A pathological description (whitespace-only, emoji-only, very long) or a card whose word cannot be saved (only punctuation, a duplicate) crashes the loop or leaves the user with an entry they cannot delete | Low-Medium | Low-Medium | PRD (accepts a free-text description; FR-004 user-authored cards); roadmap S-03 (validation covers empty + duplicate only); abuse lens (untrusted input). Mostly contingent on S-03 shipping. |
| 7 | The text the user typed about a real person is written to disk or sent off the device — directly violates the PRD promise that no description leaves the device | High | Low-Medium | PRD Non-Functional Requirements ("No description of a person entered by the user leaves the device"); S-01 decision (description is in-memory only); regression risk as S-02/S-03/S-04 add screens and effects around the input |

**Impact × Likelihood rubric.** High impact = user loses access, data, the
product's core value, or a stated promise is broken; High likelihood = area
changes weekly / three planned changes touch it / we have been burned here.
Medium = feature degrades with a workaround, touched occasionally. Low =
cosmetic, stable, rarely touched. Order rows by impact × likelihood;
protect High × High first (R1, R2). R7 is High-impact × Low-Medium — kept
because the regression path is real and the test is cheap (assert the
description never reaches storage; assert no network module is imported),
not because the scenario is frequent.

**Considered and parked (no row):** the PRD Guardrail "perceptibly instant"
card loading. At 72 words it is sub-millisecond; a unit test would assert
nothing meaningful. Revisit as a performance-budget check (not a unit test)
if S-03 lets a user accumulate hundreds of cards, or if the mount effect
grows to several serial AsyncStorage reads.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | ~6–10 hand-written realistic descriptions each surface an on-topic word in the top 1–3; a multi-topic description surfaces more than one category in the top few cards | "the lexicon covers the obvious phrasings" (natural wording like "prof", "cyclist", "into wine" may not be keys); after S-02, a word the user marked known must still sink even if heavily struggled; "one weak keyword hit equals relevance" | tokenizer normalization + stopword set; how the keyword map resolves to the 9 categories; the multi-pass order and tie-break; where the S-02 struggle tier and the S-03 deck parameter slot in | unit (pure ranking function with fixed inputs and a human-authored expectation table) | oracle problem — deriving the "expected" top word by re-running the lexicon logic inside the test; the expectation must come from a human judging the description, not from the code under test |
| #2 | identical arguments produce identical id order; the result is exactly the deck it was given (length + id-set), across empty and gibberish input, and (post-S-02) with a non-empty history, (post-S-03) with a custom deck | "stable in the two-argument form" does not imply stable in the three- and four-argument forms S-02/S-03 add; do not rely on engine sort stability — the tie-break must be explicit | the decorate/sort/undecorate the S-02 plan prescribes; the deck-parameter default the S-03 plan prescribes | unit (property-style: run over a list of descriptions, assert set equality + repeat-call determinism) | pinning the full 72-element order for a single description — brittle to every lexicon tweak (interview Q5) |
| #3 | the known-state read returns an empty map and never throws for: unset key, non-JSON string, JSON that is not an object, a legacy shape; a valid map round-trips; the same holds for the S-02 history read | "an absent key is the only bad-read case" — also corrupt string, wrong type, partially-written value; "it worked in the debug screen" is not a test | the storage key names; the exact parse-and-fallback in the known-state read; whether any consumer assumes the value is always a clean map | unit with the official `@react-native-async-storage/async-storage` jest mock, seeded with each bad value | over-mocking — asserting that `getItem` was called instead of asserting the returned value is a safe empty map |
| #4 | firing N mark-writes without awaiting between them leaves all N reflected in a later known-state read; the S-02 history write interleaved with mark-writes drops neither key's data | "the await in the screen's mark handler serializes them" — the UI re-entrancy guard is separate from the store's write queue; the test must exercise the store directly; "the final call resolved" is not "all writes landed" | the write-queue chaining in the store; whether the S-02 history writer shares or forks that queue | integration-flavoured unit (real mock AsyncStorage, no artificial delays; fire overlapping promises, await all, assert the merged result) | forcing a mid-sequence error to "prove" atomicity — read-merge-write is non-atomic here by design; assert the observable merged outcome, not a rollback that does not exist |
| #5 | any non-empty description reaches a card with a rendered word; marking through the whole queue reaches the terminal state with a working reset; gibberish still yields a card; every phase value has a render branch and a route back to input | "the queue is always 72 words so the index cannot overrun" (the S-03 custom deck breaks that); a new phase with no render branch is a blank screen; a null-guard on the current word hides the bug instead of preventing it | the phase union and every render branch; the mark-handler advance/terminal logic; how the S-02/S-03/S-04 phases are entered and exited | unit on an extracted phase reducer/helper if the logic can be isolated; otherwise a documented per-phase manual smoke checklist in §6 until a component test is warranted | e2e where a reducer unit test would catch it; a full-screen snapshot "to be safe" |
| #6 | an empty-after-trim / whitespace / emoji-only / very long description does not throw (returns the full deck, no crash); a user card whose word slugs to empty or collides is rejected with a clear reason and never creates an entry the user cannot delete | the S-03 plan's "covers empty and duplicate" does not cover slug-to-empty, oversized, or control-character text; "on-device single-user means input is safe" — the user can still brick their own manage view | the slug function's behaviour on non-alphanumeric input; the add/edit validation branches; the delete path's id matching | unit on the slug function plus the add-user-word and ranking functions with degenerate strings | happy-path-only on the form; treating "no cross-user XSS" as "input is safe" |
| #7 | after a full loop run (type a description, mark cards, restart), no AsyncStorage key contains the description text; the app imports no network module (fetch/XHR/WebSocket wrapper) in the description path | "the description is only in React state" is an assumption, not a guarantee — a future feature could add a "recent descriptions" convenience or a debug log; "on-device means private" — a shipped `console.log` or analytics call still leaves the device | every write path reachable from the input screen; whether any effect or handler persists or forwards the raw description; the list of storage keys the app owns | unit / static assertion (enumerate AsyncStorage keys after a scripted run and assert none holds the description; grep-style import check in a test or lint rule) | testing only "the input clears on submit" and calling it covered; trusting a manual read of the code instead of an assertion that fails on regression |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Ranker contract lock | Realistic descriptions surface on-topic words (human-authored oracle); the permutation + determinism invariant holds across every argument form | #1, #2 | unit | implementing | context/changes/testing-ranker-contract-lock/ |
| 2 | Storage safety net | Storage reads never throw and never silently corrupt; writes do not drop under rapid marks | #3, #4 | unit + AsyncStorage jest mock | not started | — |
| 3 | Loop-state integrity + input & privacy hardening | No dead-end or blank state on any loop phase; pathological input does not crash or brick the app; the typed description never reaches disk or the network | #5, #6, #7 | unit on isolable phase logic + `slug` / input; static assertion for the no-persist / no-network contract; documented per-phase manual smoke | not started | — |
| 4 | Quality-gates wiring | `npm test` + `tsc` + `expo lint` run in a test-only GitHub Actions job on PRs, and (optional, solo) a pre-commit hook, so Phases 1–3 cannot silently rot | cross-cutting | gates | not started | — |

**Status vocabulary** (fixed — parser literals): `not started` →
`change opened` → `researched` → `planned` → `implementing` → `complete`.

Notes on ordering: Phase 1 defends the user's stated top worry and the code
S-02/S-03 are about to churn — lock it before they land. Phase 2 addresses
the user's stated scariest untested gap and must first wire the
AsyncStorage jest mock (a sub-phase; the S-02 plan also needs this mock —
coordinate so it is added once). Phase 3 is lower priority: R5's cheapest
real test may need the loop's phase logic extracted into a plain reducer —
if that extraction is not worth it, R5 stays a documented manual-smoke
checklist and that is an acceptable answer for a solo on-device app; R6 and
R7 are small unit / static-assertion additions and R6 is mostly contingent
on S-03. Phase 4 is last because it needs real tests to gate — and is
deliberately light: a **test-only** CI job (`npm ci && npm test && tsc &&
lint`, no EAS build, so it does not touch the roadmap's parked deploy
concern), plus an optional pre-commit hook that a solo developer should
drop if `jest-expo`'s ~20–30s start-up becomes friction. No AI-native
phase: an LLM judge for Risk #1's
oracle was considered and rejected on cost × signal and the PRD Non-Goals
(no ML) — a small human-authored expectation table is the cheaper
deterministic signal.

## 4. Stack

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit | jest-expo (jest) | jest-expo ~57.0.5 / jest ~29.7.0 | configured; one test file today (`src/lib/vocabulary-ranking.test.ts`); `@jest/globals` imports, `@/` via `moduleNameMapper` |
| storage / AsyncStorage mock | `@react-native-async-storage/async-storage/jest/async-storage-mock` | ships with the installed package | none yet — see §3 Phase 2 (a sub-phase wires it via `setupFiles`) |
| component / integration | none yet | — | no component or integration tests; deliberately deferred (see §7) |
| e2e / device | none yet | — | out of scope for the rollout (see §7); app is verified via `expo export --platform web` + a local static server, and manual smoke |
| accessibility | none | — | PRD Open Question #3 (accessibility standard) is unresolved; not in this rollout |

Test-base reality: **effectively greenfield for testing.** The single unit
file was added days ago as part of S-01; there is no test culture, no
component/integration/e2e tests, and no CI running tests. Treat the rollout
as bootstrapping a suite from near-zero, not extending an existing one.

Constraint: `.npmrc` sets `legacy-peer-deps=true` (a jest-expo ↔
react-native 0.86.2 peer skew); `@react-native/jest-preset@0.86.3` is
pinned explicitly. Any new dev dependency install inherits the loosened
peer resolution.

**Stack grounding tools (current session):**
- Docs: none (no Context7 or framework-docs MCP exposed) — Expo SDK 57
  versioned docs are reachable via WebFetch against `docs.expo.dev` when a
  phase needs exact test-setup APIs; checked: 2026-09-08
- Search: web search available, not used this pass; checked: 2026-09-08
- Runtime/browser: none (no Playwright MCP) — not needed; the rollout has
  no e2e phase; checked: 2026-09-08
- Provider/platform: none — deployment is EAS / app-store; GitHub Actions
  CI is planned but not wired (relevant to §3 Phase 4); checked: 2026-09-08

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + typecheck (`npm run lint`, `npx tsc --noEmit`) | local + CI | required | syntactic / type drift |
| unit (`npm test`) | local + CI | required after §3 Phase 1 | ranking + storage logic regressions |
| test-only GitHub Actions CI (`npm ci && npm test && tsc && lint` on PR; **no EAS build**) | CI on PR | required after §3 Phase 4 | regressions in shared branch state; matters most while the S-02 / S-03 worktree branches are open. Distinct from the roadmap's parked deploy workflow — this job never touches the EAS build allowance. |
| pre-commit hook (lint + typecheck + `npm test` on staged) | local | **optional (solo)** — add when the worktree branches merge; drop if `jest-expo`'s ~20–30s start-up becomes friction | regressions before they leave the machine |
| per-phase manual smoke (documented checklist per loop phase) | local | aspirational — only real if someone commits to running it; §6.3 will hold the checklist | dead-end / blank-state regressions a state machine that isn't extracted for unit testing can't cover |
| deterministic web export smoke (`expo export --platform web` builds + serves) | local | optional | bundling / route regressions (e.g. an orphaned route after a screen delete — this actually caught one in S-01) |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a pure-logic unit test

- **Location**: `src/lib/<module>.test.ts`, next to the module under test.
- **Imports**: `import { describe, expect, it } from '@jest/globals';` then blank line,
  then `@/…` imports (external-first, then alphabetical `@/` — matches `expo lint`).
  Import fixture data directly from `@/constants/*`; never construct expectations by
  calling the function under test.
- **Reference test**: `src/lib/vocabulary-ranking.test.ts` — the
  `rankVocabulary — contract lock: determinism & permutation` block. `assertRankInvariants`
  there is the pattern for **signature-agnostic property tests**: pass each case as
  `{ name, run: () => fn(...), deck? }` so a new argument form is a new case, not a helper
  rewrite.
- **Rule**: assert *properties* (determinism = call twice and compare; permutation =
  length + id-set; ordering = a monotonic derived key), never the full output sequence —
  a full-order assertion breaks on every data tweak.
- **Run locally**: `npm test` (or `npx jest src/lib/<module>.test.ts` for one file).
  `jest-expo` start-up is ~20–30s on WSL; the assertions are instant.

### 6.2 Adding a storage test (AsyncStorage-backed)

- TBD — see §3 Phase 2. Will cover: where the `setupFiles` mock is wired,
  how to seed the mock with a bad stored value, and the reference test for
  the read-never-throws contract.

### 6.3 Adding a test for loop-screen / phase behaviour

- TBD — see §3 Phase 3. Will cover: whether the phase logic is extracted
  into a testable reducer, the per-phase manual smoke checklist for what
  cannot be unit-covered, and the static assertion pattern for the
  description-never-persisted / never-transmitted contract (Risk #7).

### 6.4 Adding a test for a new deck or lexicon rule

- **Location**: `src/lib/vocabulary-ranking.test.ts`.
- **Adding a relevance expectation** (Risk #1): append a row to `R1_RELEVANCE`. The
  description is a phrase about a *person*; `kind` is `single` (assert `ranked[0].category`)
  or `multi` (assert every `want` category appears in the top 5). **The `want` value is
  your own judgement of what a human would want to talk about — do not derive it by
  running `matchedCategories` or `rankVocabulary`.** If the current ranker does not meet a
  judgement you believe is correct, add it as an `it.failing(...)` with a comment naming
  the limitation (see `known gap B1` / `B2`) — it documents the gap and turns red when the
  scoring improves. Do not assert a specific word or the full order.
- **Adding a determinism/permutation case for a new argument form** (Risk #2): add a
  `{ name, run, deck? }` case to the matrix feeding `assertRankInvariants`. E.g. when
  S-02's `history` arg lands: `run: () => rankVocabulary(d, k, history)`. When S-03's
  `deck` arg lands: `run: () => rankVocabulary(d, k, {}, customDeck), deck: customDeck`.
  The helper needs no change.
- **`CATEGORY_ORDER` sync**: if you add a `VocabularyCategory`, the
  `CATEGORY_ORDER covers exactly the CATEGORY_KEYWORDS key set` test fails until you add
  it to the exported `CATEGORY_ORDER` array in `src/lib/vocabulary-ranking.ts`.
- **Run locally**: `npm test`.

### 6.5 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2–3 line note
here capturing anything surprising the rollout phase taught.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Component snapshot / visual tests** (Flashcard, ThemedTextInput, card
  and manage layouts) — React Native style churn breaks these constantly
  and they catch nothing meaningful at this scale. Re-evaluate if the app
  grows a design system or a visual-regression budget. (Source: Phase 2
  interview Q5.)
- **The leftover template `Explore` screen** — it is scaffold, not
  product. Re-evaluate if it is replaced with a real feature. (Source:
  Phase 2 interview Q5 area; roadmap.)
- **E2E browser / device automation (Playwright, Detox)** — the app is
  small, single-user, and on-device; full E2E setup cost dwarfs the signal
  now. Manual smoke plus the web-export build check is enough. Re-evaluate
  if a multi-step flow spans navigation + storage + platform in a way unit
  tests cannot reach. (Source: rollout scoping; interview Q5 posture.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-08 (revised same day after a user review pass)
- Stack versions last verified: 2026-09-08
- AI-native tool references last verified: 2026-09-08 (none adopted)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
