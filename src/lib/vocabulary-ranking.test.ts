import { describe, expect, it } from '@jest/globals';

import { CATEGORY_KEYWORDS } from '@/constants/category-keywords';
import { SEED_VOCABULARY, VocabularyCategory, VocabularyWord } from '@/constants/vocabulary';
import { CATEGORY_ORDER, rankVocabulary } from '@/lib/vocabulary-ranking';

const seed = SEED_VOCABULARY;
const idsOf = (words: { id: string }[]) => words.map((w) => w.id);

describe('rankVocabulary', () => {
  it('puts a not-known word from the matched category first for a single-topic description', () => {
    const firstBusinessId = seed.filter((w) => w.category === 'business')[0].id;
    // even the most-relevant category word is deprioritized once it is marked known
    const ranked = rankVocabulary("my new startup's investor", { [firstBusinessId]: true });
    expect(ranked[0].category).toBe('business');
    expect(ranked[0].id).not.toBe(firstBusinessId);
  });

  it('interleaves multiple categories for a multi-topic description', () => {
    const ranked = rankVocabulary('retired history professor who races bikes', {});
    const topCategories = new Set(ranked.slice(0, 6).map((w) => w.category));
    expect(topCategories.has('academic')).toBe(true);
    expect(topCategories.has('sports-fitness')).toBe(true);
    expect(topCategories.size).toBeGreaterThanOrEqual(2);
  });

  it('sinks a known word below an equally-relevant unknown word', () => {
    const business = seed.filter((w) => w.category === 'business');
    const firstBusiness = business[0].id;
    const secondBusiness = business[1].id;

    const ranked = rankVocabulary('startup founder', { [firstBusiness]: true });
    const order = idsOf(ranked);
    expect(order.indexOf(secondBusiness)).toBeLessThan(order.indexOf(firstBusiness));
  });

  it('never leaves the user stuck: empty input still returns the whole deck', () => {
    const ranked = rankVocabulary('', {});
    expect(ranked).toHaveLength(seed.length);
  });

  it('never leaves the user stuck: gibberish input still returns the whole deck', () => {
    const ranked = rankVocabulary('zzz qqq wubble', {});
    expect(ranked).toHaveLength(seed.length);
  });

  it('orders not-known before known in the no-match fallback', () => {
    const knownId = seed[10].id;
    const ranked = rankVocabulary('', { [knownId]: true });
    expect(ranked[ranked.length - 1].id).toBe(knownId);
  });

  it('is deterministic for identical arguments', () => {
    const args = ['coworker into trail running and startups', { [seed[3].id]: true }] as const;
    expect(idsOf(rankVocabulary(...args))).toEqual(idsOf(rankVocabulary(...args)));
  });

  it('returns a permutation of the seed for any description (no drops, no duplicates)', () => {
    const seedIds = new Set(seed.map((w) => w.id));
    const descriptions = [
      '',
      'zzz',
      'my manager who just got back from a hiking trip in Peru',
      "girlfriend's dad, a wine-collecting cardiologist who paints",
      'startup startup startup',
    ];
    for (const description of descriptions) {
      const ranked = rankVocabulary(description, {});
      expect(ranked).toHaveLength(seed.length);
      expect(new Set(ranked.map((w) => w.id))).toEqual(seedIds);
    }
  });
});

// ── Phase 1 rollout: "Ranker contract lock" ──────────────────────────────────
// context/foundation/test-plan.md §3 Phase 1 · Risks #1 (relevance) and #2
// (determinism / permutation). See context/changes/testing-ranker-contract-lock/.

/**
 * A rank invocation packaged as a thunk so future argument forms plug in without
 * touching this helper: S-02 adds `run: () => rankVocabulary(d, k, history)`,
 * S-03 adds `run: () => rankVocabulary(d, k, {}, customDeck)` with `deck` set.
 */
type RankCase = { name: string; run: () => VocabularyWord[]; deck?: VocabularyWord[] };

/** Assert determinism (identical args → identical id order) and the permutation invariant. */
function assertRankInvariants(cases: RankCase[]): void {
  for (const c of cases) {
    const deck = c.deck ?? SEED_VOCABULARY;
    const deckIds = new Set(deck.map((w) => w.id));

    expect(idsOf(c.run())).toEqual(idsOf(c.run()));

    const result = c.run();
    expect(result).toHaveLength(deck.length);
    expect(new Set(result.map((w) => w.id))).toEqual(deckIds);
  }
}

describe('rankVocabulary — contract lock: determinism & permutation (Risk #2)', () => {
  const descriptions = [
    '',
    'zzz qqq wubble',
    'my new manager, a former startup founder',
    'retired history professor who races bikes',
    'my married coworker who loves cycling',
  ];
  const knownStates: { name: string; state: Record<string, boolean> }[] = [
    { name: 'empty', state: {} },
    { name: 'partial', state: { [seed[0].id]: true, [seed[35].id]: true, [seed[71].id]: true } },
    { name: 'all known', state: Object.fromEntries(seed.map((w) => [w.id, true] as const)) },
  ];

  it('is deterministic and returns an exact seed permutation across a description × knownState matrix', () => {
    // Asserts: repeated calls give the identical id order; every result is exactly
    // SEED_VOCABULARY (length + id-set). Catches an S-02/S-03 or lexicon change that
    // makes the ranker non-reproducible or drops/duplicates a word.
    // Anti-pattern avoided: pinning the full 72-word order.
    const cases: RankCase[] = [];
    for (const description of descriptions) {
      for (const k of knownStates) {
        cases.push({ name: `"${description}" / ${k.name}`, run: () => rankVocabulary(description, k.state) });
      }
    }
    assertRankInvariants(cases);
  });

  it('concatenates the four ranking tiers in non-decreasing order', () => {
    // Human oracle: "a wine sommelier" matches the food-cuisine category only
    // ("wine" and "sommelier" are food-cuisine keywords and appear in no other
    // category). With one matched word and one unmatched word marked known, all
    // four tiers (matched-not-known → matched-known → unmatched-not-known →
    // unmatched-known) are populated; their concatenation order is the invariant.
    const matchedCats = new Set<VocabularyCategory>(['food-cuisine']);
    const food = seed.filter((w) => w.category === 'food-cuisine');
    const nonFood = seed.filter((w) => w.category !== 'food-cuisine');
    const knownState: Record<string, boolean> = {
      [food[0].id]: true,
      [nonFood[0].id]: true,
    };
    const ranked = rankVocabulary('a wine sommelier', knownState);

    const tierOf = (w: VocabularyWord): number => {
      const matched = matchedCats.has(w.category);
      const known = knownState[w.id] === true;
      if (matched && !known) return 0;
      if (matched && known) return 1;
      if (!matched && !known) return 2;
      return 3;
    };

    const tiers = ranked.map(tierOf);
    for (let i = 1; i < tiers.length; i += 1) {
      expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]);
    }
  });

  it('breaks a three-category score tie deterministically by CATEGORY_ORDER', () => {
    // Human oracle: "married" → family-relationships, "coworker" → business,
    // "cycling" → sports-fitness — three categories, each scoring 1. The tie-break
    // is the explicit CATEGORY_ORDER comparator, not engine sort stability.
    // Asserts the category prefix, never the words.
    const run = () => rankVocabulary('my married coworker who loves cycling', {});
    const prefix = run()
      .slice(0, 3)
      .map((w) => w.category);
    expect(prefix).toEqual(['business', 'sports-fitness', 'family-relationships']);
    expect(
      run()
        .slice(0, 3)
        .map((w) => w.category),
    ).toEqual(prefix);
  });

  it('CATEGORY_ORDER covers exactly the CATEGORY_KEYWORDS key set', () => {
    // TypeScript enforces CATEGORY_KEYWORDS keys (a Record) but not CATEGORY_ORDER
    // (a bare array). A category added to the union but forgotten here would be
    // silently un-rankable. This closes that gap.
    expect([...CATEGORY_ORDER].sort()).toEqual(Object.keys(CATEGORY_KEYWORDS).sort());
  });
});

/**
 * R1 expectation table — every expected value is a HUMAN judgement of the
 * description, never computed by calling matchedCategories / rankVocabulary
 * (the oracle problem). Reviewed 2026-09-08.
 *   single: ranked[0].category is the expected on-topic category
 *   multi:  every expected category appears within the top 5
 */
const R1_RELEVANCE: (
  | { d: string; kind: 'single'; want: VocabularyCategory }
  | { d: string; kind: 'multi'; want: VocabularyCategory[] }
)[] = [
  { d: 'my new manager, a former startup founder', kind: 'single', want: 'business' },
  {
    d: "my girlfriend's father, a retired history teacher",
    kind: 'multi',
    want: ['academic', 'family-relationships'],
  },
  {
    d: "a colleague who's really into trail running and cycling",
    kind: 'single',
    want: 'sports-fitness',
  },
  {
    d: 'a college friend who now works in finance and does a lot of cycling',
    kind: 'multi',
    want: ['business', 'sports-fitness'],
  },
  { d: 'my aunt, just back from backpacking around Southeast Asia', kind: 'single', want: 'travel' },
  { d: 'a chef who runs a small farm-to-table restaurant', kind: 'single', want: 'food-cuisine' },
];

describe('rankVocabulary — contract lock: relevance (Risk #1)', () => {
  // Catches a lexicon edit (mis-categorised or over-broad keyword) or an S-02/S-03
  // change that pushes an on-topic category out of the top slot / top 5 for a
  // realistic person-description. Anti-pattern avoided: the oracle problem, and
  // exact-word / full-order assertions.
  it.each(R1_RELEVANCE)('surfaces an on-topic category for "$d"', (row) => {
    const ranked = rankVocabulary(row.d, {});
    if (row.kind === 'single') {
      expect(ranked[0].category).toBe(row.want);
    } else {
      const top5 = new Set(ranked.slice(0, 5).map((w) => w.category));
      for (const cat of row.want) {
        expect(top5.has(cat)).toBe(true);
      }
    }
  });

  // Part B — known keyword false-positives. The assertion states the human-desired
  // behaviour; `it.failing` passes because the current scorer does NOT do it (a
  // score-1 role/verb keyword hit is treated as equal relevance — no salience).
  // These flip to hard failures the day the scoring or lexicon is improved.
  it.failing(
    'known gap B1 — "a coworker training for an Ironman" should lead with sports-fitness, not business',
    () => {
      const ranked = rankVocabulary('a coworker training for an Ironman', {});
      expect(ranked[0].category).toBe('sports-fitness');
    },
  );

  it.failing(
    'known gap B2 — "a chef who runs a small farm-to-table restaurant": "runs" should not pull a fitness word into the top 3',
    () => {
      const ranked = rankVocabulary('a chef who runs a small farm-to-table restaurant', {});
      expect(ranked.slice(0, 3).every((w) => w.category !== 'sports-fitness')).toBe(true);
    },
  );
});
