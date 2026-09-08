---
date: 2026-09-08T10:44:23+0200
researcher: Claude (Sonnet 5)
git_commit: 488b87b2a4c645faaf74a89d9d1a0092d6ef0f80
branch: master
repository: eloquence-flashcards
topic: "Ground rollout Phase 1 (Ranker contract lock) — Risks #1 (irrelevant top word) and #2 (non-deterministic / non-permutation ranking)"
tags: [research, codebase, ranker, vocabulary-ranking, test-plan, phase-1]
status: complete
last_updated: 2026-09-08
last_updated_by: Claude (Sonnet 5)
---

# Research: Ranker contract lock — Risks #1 and #2

**Date**: 2026-09-08T10:44:23+0200
**Researcher**: Claude (Sonnet 5)
**Git Commit**: 488b87b2a4c645faaf74a89d9d1a0092d6ef0f80
**Branch**: master
**Repository**: eloquence-flashcards

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md` ("Ranker contract lock").
For Risk #1 (a realistic description surfaces an irrelevant top word) and Risk #2 (the
ranker stops being deterministic, or shows a word twice / skips one / never reaches its
end screen): where does each risk actually pass through the code, what behaviour would
prove protection (from analysis, not implementation shape), and what is the cheapest test
that catches it. Verify — do not blindly accept — the response guidance already in the
test plan.

## Summary

- **Both risks live in one pure function**: `rankVocabulary` in
  `src/lib/vocabulary-ranking.ts:144-181`, plus the two data/logic inputs it reads —
  the hand-authored lexicon `CATEGORY_KEYWORDS` (`src/constants/category-keywords.ts:17-292`)
  and the seed deck `SEED_VOCABULARY` (`src/constants/vocabulary.ts`, 72 words, 9
  categories × 8). The function has **no I/O, no clock, no randomness** — it is already
  structured to be unit-tested.
- **Risk #1 relevance quality is decided by two things**: (a) whether the user's wording
  produces a token that is a key in `CATEGORY_KEYWORDS` (`tokenize` at
  `vocabulary-ranking.ts:67-74` — lowercase, split on `/[^a-z0-9]+/`, drop tokens < 3
  chars and a 39-word stoplist), and (b) the category-score sort in `matchedCategories`
  (`:77-96`) which ranks categories by raw keyword-hit count, tie-broken by a fixed
  `CATEGORY_ORDER` (`:8-18`). A single incidental keyword hit in an unrelated category
  scores that category `1` and can float one of its words into the top 3 via the
  round-robin (`:103-123`). That is the concrete shape of "irrelevant top word".
- **Risk #2 surfaces in the loop screen but the defect is in the ranker.**
  `src/app/index.tsx:40` calls `setQueue(rankVocabulary(trimmed, knownState))` and
  `handleMark` advances with `if (index + 1 >= queue.length) setPhase('done')`. That "done"
  logic assumes `queue` is an exact 72-word permutation of the deck. If `rankVocabulary`
  ever returns fewer entries, a word is never shown and `done` fires early; more entries
  or a duplicate means a word shows twice. The invariant that prevents this
  ("permutation of `SEED_VOCABULARY`, every word exactly once") is stated in the
  docstring (`:129-132`) and only *partially* tested today.
- **Response guidance in the test plan is sound and needs only small sharpening.** The
  "human-authored oracle, not re-run the lexicon" instruction for Risk #1 is correct and
  load-bearing — see the tie/round-robin analysis below for why an implementation-derived
  oracle would be tautological. For Risk #2, "don't rely on engine sort stability" is
  *already* satisfied in code (the comparator has an explicit `|| CATEGORY_ORDER.indexOf`
  tie-break at `:92-94`), but the property is untested; and the invariant is tested only
  for the 2-argument call form.
- **Cheapest test for both: pure unit tests in the existing
  `src/lib/vocabulary-ranking.test.ts`**, run by `npm test` (jest-expo). **No
  infrastructure-setup phase is required for Phase 1** — jest-expo is already configured
  (`package.json` `"jest"` block), the test file already exists and imports
  `@jest/globals` + `SEED_VOCABULARY` directly, and `rankVocabulary` needs no mock. The
  AsyncStorage mock the *rollout* needs belongs to Phase 2, not here.

## Detailed Findings

### Where Risk #1 passes through the code

**Entry point**: `rankVocabulary(description, knownState)` — `src/lib/vocabulary-ranking.ts:144`.

Path for relevance:

1. **`tokenize(description)`** — `:67-74`
   ```ts
   description
     .toLowerCase()
     .split(/[^a-z0-9]+/)
     .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
   ```
   Consequences that shape relevance:
   - **No stemming** (the lexicon comment at `category-keywords.ts:12-13` acknowledges
     this and asks authors to add variants). "cyclist" is a key; "cycles" is not.
     "professor" is a key; "prof" is not. Any user shorthand outside the enumerated
     variants scores nothing.
   - **`< 3` chars dropped** — "cook" survives, but a 2-letter token never matches.
   - **39-word stoplist** (`:24-64`) includes `person`, `people`, `friend`, `guy`,
     `someone` — good; but also `talk`, `meet`, `get`, `this`, `not` — harmless here.
   - Non-ASCII is split out entirely: "café" → `caf`, "José" → `jos`. Accented input is
     lossy but not a crash.

2. **`matchedCategories(tokens)`** — `:77-96`
   ```ts
   for (const category of CATEGORY_ORDER) {
     let score = 0;
     for (const keyword of CATEGORY_KEYWORDS[category]) if (tokens.has(keyword)) score += 1;
     if (score > 0) scored.push({ category, score });
   }
   scored.sort((a, b) => b.score - a.score || CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
   ```
   - Score is **raw hit count**, unweighted. Two categories each matched by one keyword
     tie at `1` and are ordered by `CATEGORY_ORDER` position, not by how central the
     keyword is to the description.
   - **Any category with `score > 0` is "matched"** and contributes words to the top
     tier. There is no minimum threshold and no notion of a dominant topic.

3. **`roundRobin(matched, matchedNotKnown)`** — `:103-123`, called at `:176`
   - Emits one word per matched category per lap, in matched (score-then-CATEGORY_ORDER)
     order, preserving seed order within a category.
   - So for a description that matches 3 categories at score 1, the top 3 cards are the
     first seed word of each of those 3 categories, in `CATEGORY_ORDER`.

**Concrete "irrelevant top word" example** (traced by hand):
"my married coworker who's really into cycling" →
tokens `{married, coworker, really→stop, into→stop, cycling}` →
`married` ∈ family-relationships (1), `coworker` ∈ business (1), `cycling` ∈ sports-fitness (1) →
three-way tie at 1 → CATEGORY_ORDER puts **business** first (index 0), then
**sports-fitness** (7), then **family-relationships** (8) →
round-robin top 3 = `acumen` (business), `resilience` (sports-fitness), `rapport`
(family-relationships).
Whether `rapport` at rank 3 is "irrelevant" for *a cycling coworker* is exactly the
judgement call Risk #1's oracle table must make explicit and a human must own. An
implementation-derived oracle would simply assert "the code does what the code does".

### Where Risk #2 passes through the code

**The invariant** (docstring `:129-132`): the return value is always a permutation of
the deck — every word exactly once — so the caller can treat it as both the ranked list
and the no-dead-ends fallback.

**How the invariant is produced** — `:162-180`:
- Every seed word is pushed into exactly one of four buckets in a single pass
  (`matchedNotKnown[cat]`, `matchedKnown[cat]`, `unmatchedNotKnown`, `unmatchedKnown`) —
  `:162-173`.
- The result concatenates `roundRobin(matched, matchedNotKnown)` ++
  `roundRobin(matched, matchedKnown)` ++ `unmatchedNotKnown` ++ `unmatchedKnown` — `:175-180`.
- `roundRobin` emits each bucket element once (cursor advances, never resets) — `:108-121`.

**Determinism** hinges on:
- No `Math.random`, no `Date`, no `Object.keys` iteration order dependence — confirmed
  absent. `matchedCategories` iterates the explicit `CATEGORY_ORDER` array (`:79`), not
  object keys.
- The category sort comparator (`:92-94`) has an **explicit second key**
  (`CATEGORY_ORDER.indexOf`), so it does not depend on `Array.prototype.sort` being
  stable. (Hermes and modern V8 are stable anyway, but the code does not rely on it.)
- `roundRobin` order is fully determined by `order` (the matched array) and seed order.

**Where R2 would surface for the user** — `src/app/index.tsx`:
- `:40` `setQueue(rankVocabulary(trimmed, knownState))`
- `handleMark`: `const next = index + 1; if (next >= queue.length) setPhase('done'); else setIndex(next);`
- If `queue.length !== 72` or `queue` contains a duplicate id, the user either never
  sees a word (early `done`) or sees one twice. "Never reaches its end screen" happens if
  a bug made the list grow (index never catches `queue.length`) — unlikely given the
  bucket logic, but the *point of the test* is that no future change to the 4-pass
  concatenation (S-02 adds a struggle re-sort; S-03 swaps the source array) breaks it.

### Verifying the response guidance in the test plan

| Guidance in `test-plan.md` §2 | Verdict after code analysis |
|---|---|
| R1: "expectation from human judgement, not from re-running the lexicon (oracle problem)" | **Confirmed and load-bearing.** The tie + CATEGORY_ORDER + round-robin chain means "what word leads" is a non-obvious function of the lexicon. A test that computes the expected word by calling `matchedCategories`/`rankVocabulary` would pass against any lexicon, including a broken one. Expectations must be a human reading the description and naming an on-topic word. |
| R1: "~6–10 realistic descriptions, top 1–3 on-topic; multi-topic → >1 category up top" | **Good, with one addition**: also include at least one "dominant topic + incidental keyword" case that asserts a specifically-named off-topic word is **NOT** in the top N. The current suite only ever asserts presence, never absence. |
| R1: "after S-02, a known word must still sink even if heavily struggled" | **Correct but not testable in Phase 1** — the `history` parameter does not exist yet. Treat as a forward hook: write the R1 helper so this case can be added as a one-liner when S-02's `history` arg lands. Do not stub it now. |
| R2: "identical args → identical id order" | Correct; **currently tested once** (`vocabulary-ranking.test.ts:52-55`, one description, one knownState). Widen to a small matrix (empty / partial / all-known knownState; a tie-inducing description). |
| R2: "result is exactly the deck given (length + id-set), across empty/gibberish and every argument form" | Correct; **the permutation invariant is tested** (`:57-71`, 5 descriptions) **but only for the 2-arg form**. S-02 will add `history` (3rd), S-03 will add `deck` (4th, default `SEED_VOCABULARY`). Phase 1 can only test the 2-arg form today; write the assertion as a reusable helper so the 3- and 4-arg forms plug in when those branches land. |
| R2: "do not rely on engine sort stability" | **Already satisfied in code** (`:92-94` explicit tie-break). The gap is that the tie path is **untested** — add a description that makes ≥3 categories score 1 and assert the category order is the `CATEGORY_ORDER` order, deterministically across repeated calls. |
| R2: "do not pin the full 72-word order" | **Correct.** Assert *properties* (determinism, permutation, tier-concatenation order), never the whole sequence — that would break on every lexicon edit (interview Q5). |

### Existing tests — coverage and gaps

`src/lib/vocabulary-ranking.test.ts` (8 tests, all green, run by `npm test`):

| Existing test | Covers | Gap it leaves |
|---|---|---|
| `puts a not-known word from the matched category first` (`:10-16`) | R1 (category-level, human oracle) + known-sink | single-topic only; short keyword phrase, not a person description |
| `interleaves multiple categories` (`:18-24`) | R1 multi-topic (asserts `academic` + `sports-fitness` in top 6) | asserts presence only; keyword-dense phrase; no "off-topic word absent" |
| `sinks a known word below an equally-relevant unknown word` (`:26-34`) | R2-adjacent tier order **within** the business (matched) bucket | does not pin the cross-tier concatenation order (matched-known before unmatched-not-known) |
| `empty input → whole deck` / `gibberish → whole deck` (`:36-44`) | R2 permutation length for no-match | length only, not id-set, for these two |
| `orders not-known before known in the no-match fallback` (`:46-50`) | R2 tier order for the unmatched path | one known word only |
| `is deterministic for identical arguments` (`:52-55`) | R2 determinism | one description, one knownState; no tie path |
| `returns a permutation of the seed for any description` (`:57-71`) | R2 permutation (length + id-set), 5 descriptions | 2-arg form only; no knownState variation; no tie path |

**Net**: R2's invariant is decently covered for today's signature; R1 has two thin
category-level checks and no human-authored expectation table; the category-tie path and
the 4-pass tier-concatenation order are unverified.

### Speculative-risk / misleading-evidence check

- **Neither risk is speculative.** R1's failure ("user gets an off-topic card") is
  observable and the response tests behaviour that exists. R2's invariant is the
  documented contract with a partial existing test — tightening it and future-proofing it
  for the S-02/S-03 signatures is not "adding a safeguard first".
- **Hot-spot evidence is fine as written.** `test-plan.md` §2 for R1/R2 cites the roadmap
  (S-02/S-03 modify the ranker), not a file. The Phase-1 discovery hot-spot scan
  mentioned `src/app/` churn, but that was the `app-tabs.tsx` debug-tab noise; R1/R2's
  defect surface is `src/lib/vocabulary-ranking.ts` + `src/constants/category-keywords.ts`,
  and `src/app/index.tsx` is only where R2 *manifests*. No §2 backport needed.
- **No infrastructure gap for Phase 1.** If `/10x-plan` proposes an infra-setup phase for
  this change, push back — jest-expo is wired, the test file exists, `rankVocabulary` is
  pure. The only setup-shaped work is authoring the R1 expectation table and a small
  reusable determinism/permutation helper, both of which are test artifacts (a first
  sub-phase), not infrastructure.

## Code References

- `src/lib/vocabulary-ranking.ts:144-181` — `rankVocabulary`; both risks live here
- `src/lib/vocabulary-ranking.ts:67-74` — `tokenize`; R1 relevance depends on this
  normalization (no stemming, `< 3` char drop, 39-word stoplist)
- `src/lib/vocabulary-ranking.ts:77-96` — `matchedCategories`; raw hit-count score, no
  threshold, explicit `CATEGORY_ORDER` tie-break at `:92-94`
- `src/lib/vocabulary-ranking.ts:103-123` — `roundRobin`; determines which matched-category
  word leads
- `src/lib/vocabulary-ranking.ts:162-180` — the 4-bucket pass and the 4-way concatenation;
  R2's permutation invariant is produced here
- `src/lib/vocabulary-ranking.ts:8-18` — `CATEGORY_ORDER` (the deterministic tie-break axis)
- `src/lib/vocabulary-ranking.ts:129-132` — docstring stating the permutation invariant
- `src/constants/category-keywords.ts:17-292` — `CATEGORY_KEYWORDS`; the hand-authored
  lexicon whose coverage is R1's real determinant
- `src/constants/vocabulary.ts` — `SEED_VOCABULARY` (72 words, 9 categories × 8; ids are
  kebab slugs; first id per category in file order: business→`acumen`, academic→`discourse`,
  arts-culture→`aesthetic`, science-tech→`algorithm`, current-events→`polarize`,
  travel→`itinerary`, food-cuisine→`palate`, sports-fitness→`resilience`,
  family-relationships→`rapport`)
- `src/lib/vocabulary-ranking.test.ts:1-72` — the 8 existing unit tests
- `src/app/index.tsx:40` — `setQueue(rankVocabulary(trimmed, knownState))`; the sole
  production call site
- `src/app/index.tsx` `handleMark` — `if (index + 1 >= queue.length) setPhase('done')`;
  the "done" logic that assumes a 72-word permutation
- `package.json` `"jest"` block — `preset: jest-expo`, `moduleNameMapper` for `@/`;
  `"test": "jest"`. No `setupFiles` yet.

## Architecture Insights

- **The ranker is a clean pure seam by design** (S-01 plan Critical Implementation
  Details). Both S-02 (struggle-weight re-sort of the not-known buckets) and S-03 (swap
  `SEED_VOCABULARY` for a passed-in `deck`) extend it *without* adding I/O. This is why
  Phase 1's tests can and should be pure unit tests, and why they must be written to
  extend cleanly to the 3- and 4-argument forms.
- **Relevance is a data problem, not a control-flow problem.** The control flow
  (tokenize → score → round-robin) is simple and unlikely to regress on its own. What
  regresses R1 is a lexicon edit: adding a keyword to the wrong category, or a broad
  keyword (`data`, `work`, `race`) that fires on unrelated descriptions. The R1 test's
  job is to make such edits fail a build.
- **`CATEGORY_ORDER` is duplicated knowledge.** It is a hand-maintained array in
  `vocabulary-ranking.ts:8-18` that must stay in sync with the `VocabularyCategory` union
  in `vocabulary.ts`. `CATEGORY_KEYWORDS` is `Record<VocabularyCategory, ...>` so TS
  forces its keys; `CATEGORY_ORDER` is a bare array and TS does **not** enforce
  completeness. A category added to the union but forgotten in `CATEGORY_ORDER` would be
  silently un-rankable (its words only ever appear via the unmatched passes). Worth one
  assertion in Phase 1: `CATEGORY_ORDER` contains exactly the keys of `CATEGORY_KEYWORDS`.

## Historical Context (from prior changes)

- `context/changes/tailored-flashcard-loop/plan.md` — S-01; introduced `rankVocabulary`,
  the 4-pass design, the permutation/determinism invariant, and `jest-expo`. Its
  "Critical Implementation Details" section is the origin of the invariant this phase locks.
- `context/changes/tailored-flashcard-loop/reviews/impl-review.md` — S-01 review; finding
  F6 already noted a vacuous assertion in `vocabulary-ranking.test.ts` test 1 and it was
  fixed. Confirms the test file is actively curated.
- `context/changes/adaptive-card-ranking/plan.md` (S-02, planned, worktree
  `feat/adaptive-card-ranking`) — will change the signature to
  `rankVocabulary(description, knownState, history?: MarkHistory)` and re-sort the
  not-known buckets by `struggleScore` with an explicit decorate/sort/undecorate
  (`plan.md:111-120`, `:127-130`, `:175-181`). Its own Phase 1 adds R1/R2-style tests for
  the weighted form.
- `context/changes/custom-flashcards/plan.md` (S-03, planned, worktree
  `feat/custom-flashcards`) — will add `deck` as the **4th** positional parameter
  (`rankVocabulary(description, knownState, history = {}, deck = SEED_VOCABULARY)`,
  `plan.md:111-115`, `:127-130`) and replace `const seed = SEED_VOCABULARY` with
  `const seed = deck`. Merge order is S-02 first, then S-03 rebases.
- `context/foundation/test-plan.md` §2/§5 — the risk map and response guidance this
  research verifies; §3 Phase 1 row is `change opened` for this change-id.

## Related Research

- None yet — this is the first `/10x-research` for the testing rollout.

## Open Questions

- **R1 oracle table size and content** — a `/10x-plan` decision: which ~6–10 descriptions,
  and for each, which category(ies) / which specific on-topic word(s) a human asserts, and
  which off-topic word(s) must be absent from the top N. Needs a human to author the
  expectations (the point of the "no lexicon-derived oracle" rule).
- **Whether to extract a shared assertion helper now** (`assertDeterministicPermutation(fn, cases)`)
  so S-02/S-03 plug their new arg forms in, or let each branch add its own. Cheap either
  way; a `/10x-plan` call.
- **The `CATEGORY_ORDER` ↔ `CATEGORY_KEYWORDS` sync assertion** — in scope for this phase
  or a separate hardening note? Recommend: one small test here, it is free and closes a
  real silent-failure path relevant to R1.
