---
change_id: testing-ranker-contract-lock
title: Ranker contract-lock tests — relevance + determinism/permutation invariant
status: implementing
created: 2026-09-08
updated: 2026-09-08
archived_at: null
---

## Notes

Rollout Phase 1 of `context/foundation/test-plan.md` ("Ranker contract lock").

Covers:
- **Risk #1** — a realistic description surfaces an irrelevant top word; the
  ranked-not-random match is the whole product, so an off-topic top card makes the app
  no better than a generic deck.
- **Risk #2** — the ranker stops being deterministic, or shows a word twice / skips one
  entirely / never reaches its end screen.

Test types: **unit only, no e2e.**

Risk response intent (from the test plan's §2 Risk Response Guidance):
- **R1**: ~6–10 hand-written realistic descriptions each surface an on-topic word in the
  top 1–3; a multi-topic description surfaces more than one category in the top few.
  The expected word must come from **human judgement of the description**, never from
  re-running the lexicon logic inside the test (oracle problem). Also: after S-02 lands,
  a word the user marked known must still sink even if heavily struggled.
- **R2**: identical arguments produce identical id order; the result is exactly the deck
  it was given (length + id-set), across empty / gibberish input and every argument form
  (2-arg today; the S-02 `history` arg and the S-03 `deck` arg once those land). Do **not**
  pin the full 72-word order for a single description.

Next: `/10x-research testing-ranker-contract-lock` to ground where R1/R2 actually pass
through the code and what behaviour would prove protection.
