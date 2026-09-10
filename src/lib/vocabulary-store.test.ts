import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { SEED_VOCABULARY } from '@/constants/vocabulary';
import { addUserWord } from '@/lib/user-vocabulary';
import { rankVocabulary } from '@/lib/vocabulary-ranking';
import {
  getAllVocabulary,
  getKnownState,
  KnownStateReadError,
  setWordKnownState,
} from '@/lib/vocabulary-store';

jest.mock('@/lib/supabase');
const { __db, __reset, __setOffline, __setUser } =
  jest.requireMock<typeof import('@/lib/__mocks__/supabase')>('@/lib/supabase');

const KNOWN_STATE_CACHE_KEY = 'vocabulary-known-state';
const USER = 'user-1';

beforeEach(async () => {
  __reset();
  await AsyncStorage.clear();
});

describe('getKnownState', () => {
  it('returns {} when there is no session', async () => {
    await expect(getKnownState()).resolves.toEqual({});
  });

  it('reads the user rows from Supabase and refreshes the local cache', async () => {
    __setUser(USER);
    __db.known_state.push(
      { user_id: USER, word_id: 'acumen', known: true },
      { user_id: USER, word_id: 'synergy', known: false },
    );

    await expect(getKnownState()).resolves.toEqual({ acumen: true, synergy: false });
    const cached = JSON.parse((await AsyncStorage.getItem(KNOWN_STATE_CACHE_KEY)) ?? 'null');
    expect(cached).toEqual({ acumen: true, synergy: false });
  });

  it('falls back to the cache when the request fails', async () => {
    __setUser(USER);
    await AsyncStorage.setItem(KNOWN_STATE_CACHE_KEY, JSON.stringify({ acumen: true }));
    __setOffline(true);

    await expect(getKnownState()).resolves.toEqual({ acumen: true });
  });

  it('returns {} offline with no cache', async () => {
    __setUser(USER);
    __setOffline(true);
    await expect(getKnownState()).resolves.toEqual({});
  });

  it('throws KnownStateReadError on a corrupt cache while offline', async () => {
    __setUser(USER);
    await AsyncStorage.setItem(KNOWN_STATE_CACHE_KEY, 'not json {');
    __setOffline(true);
    await expect(getKnownState()).rejects.toBeInstanceOf(KnownStateReadError);
  });
});

describe('setWordKnownState', () => {
  it('throws NotAuthenticatedError with no session', async () => {
    await expect(setWordKnownState('acumen', true)).rejects.toMatchObject({
      name: 'NotAuthenticatedError',
    });
    expect(__db.known_state).toHaveLength(0);
  });

  it('upserts one row for the user and patches the cache', async () => {
    __setUser(USER);
    await AsyncStorage.setItem(KNOWN_STATE_CACHE_KEY, JSON.stringify({ synergy: false }));

    await setWordKnownState('acumen', true);

    expect(__db.known_state).toEqual([{ user_id: USER, word_id: 'acumen', known: true }]);
    const cached = JSON.parse((await AsyncStorage.getItem(KNOWN_STATE_CACHE_KEY)) ?? 'null');
    expect(cached).toEqual({ synergy: false, acumen: true });
  });

  it('overwrites an existing row rather than duplicating it', async () => {
    __setUser(USER);
    await setWordKnownState('acumen', true);
    await setWordKnownState('acumen', false);
    expect(__db.known_state).toEqual([{ user_id: USER, word_id: 'acumen', known: false }]);
  });

  it('throws on a network failure (does not lie about success)', async () => {
    __setUser(USER);
    __setOffline(true);
    await expect(setWordKnownState('acumen', true)).rejects.toThrow();
  });
});

describe('getAllVocabulary', () => {
  it('is exactly the seed deck when the user has added no cards', async () => {
    __setUser(USER);
    const deck = await getAllVocabulary();
    expect(deck.map((w) => w.id)).toEqual(SEED_VOCABULARY.map((w) => w.id));
  });

  it('appends the user cards after the seed deck, seed order preserved', async () => {
    __setUser(USER);
    await addUserWord({ word: 'gravitas', definition: 'a dignified manner', category: 'academic' });
    await addUserWord({
      word: 'panache',
      definition: 'flamboyant confidence',
      category: 'arts-culture',
    });

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

  it('feeds rankVocabulary a merged deck in which a stored user card ranks in its category', async () => {
    __setUser(USER);
    await addUserWord({
      word: 'gravitas',
      definition: 'a serious, dignified manner',
      category: 'academic',
    });

    const deck = await getAllVocabulary();
    const ranked = rankVocabulary('a philosophy professor', {}, deck);

    expect(ranked).toHaveLength(deck.length);
    expect(new Set(ranked.map((w) => w.id))).toEqual(new Set(deck.map((w) => w.id)));
    const userIdx = ranked.findIndex((w) => w.id === 'user-gravitas');
    const unmatchedIdx = ranked.findIndex((w) => w.category === 'food-cuisine');
    expect(userIdx).toBeGreaterThanOrEqual(0);
    expect(userIdx).toBeLessThan(unmatchedIdx);
  });
});
