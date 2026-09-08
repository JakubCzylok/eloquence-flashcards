import { describe, expect, it } from '@jest/globals';

import { SEED_VOCABULARY } from '@/constants/vocabulary';
import { rankVocabulary } from '@/lib/vocabulary-ranking';

const seed = SEED_VOCABULARY;
const idsOf = (words: { id: string }[]) => words.map((w) => w.id);

describe('rankVocabulary', () => {
  it('puts a word from the matched category first for a single-topic description', () => {
    const knownState: Record<string, boolean> = {};
    const ranked = rankVocabulary("my new startup's investor", knownState);
    expect(ranked[0].category).toBe('business');
    expect(knownState[ranked[0].id]).toBeUndefined(); // not a known word
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
