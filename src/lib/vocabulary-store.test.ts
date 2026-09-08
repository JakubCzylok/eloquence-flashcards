import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';

import { SEED_VOCABULARY } from '@/constants/vocabulary';
import { rankVocabulary } from '@/lib/vocabulary-ranking';
import { addUserWord } from '@/lib/user-vocabulary';
import { getAllVocabulary } from '@/lib/vocabulary-store';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('getAllVocabulary', () => {
  it('is exactly the seed deck when the user has added no cards', async () => {
    const deck = await getAllVocabulary();
    expect(deck.map((w) => w.id)).toEqual(SEED_VOCABULARY.map((w) => w.id));
  });

  it('appends user cards after the seed deck, preserving seed order', async () => {
    await addUserWord({ word: 'gravitas', definition: 'a dignified manner', category: 'academic' });
    await addUserWord({ word: 'panache', definition: 'flamboyant confidence', category: 'arts-culture' });

    const deck = await getAllVocabulary();

    expect(deck).toHaveLength(SEED_VOCABULARY.length + 2);
    expect(deck.slice(0, SEED_VOCABULARY.length).map((w) => w.id)).toEqual(
      SEED_VOCABULARY.map((w) => w.id),
    );
    expect(deck.slice(SEED_VOCABULARY.length).map((w) => w.id)).toEqual([
      'user-gravitas',
      'user-panache',
    ]);
  });

  it('feeds rankVocabulary a merged deck in which a stored user card ranks in its category (plan step 1.5)', async () => {
    await addUserWord({
      word: 'gravitas',
      definition: 'a serious, dignified manner',
      category: 'academic',
    });

    const deck = await getAllVocabulary();
    const ranked = rankVocabulary('a philosophy professor', {}, deck);

    // permutation over the merged deck
    expect(ranked).toHaveLength(deck.length);
    expect(new Set(ranked.map((w) => w.id))).toEqual(new Set(deck.map((w) => w.id)));
    // the stored user card ranks ahead of at least one unmatched-category word
    const userIdx = ranked.findIndex((w) => w.id === 'user-gravitas');
    const unmatchedIdx = ranked.findIndex((w) => w.category === 'food-cuisine');
    expect(userIdx).toBeGreaterThanOrEqual(0);
    expect(userIdx).toBeLessThan(unmatchedIdx);
  });
});
