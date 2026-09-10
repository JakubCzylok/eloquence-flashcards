import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { SEED_VOCABULARY } from '@/constants/vocabulary';
import {
  addUserWord,
  deleteUserWord,
  getUserWords,
  slug,
  updateUserWord,
  UserWordsReadError,
} from '@/lib/user-vocabulary';

jest.mock('@/lib/supabase');
const { __db, __reset, __setOffline, __setUser } =
  jest.requireMock<typeof import('@/lib/__mocks__/supabase')>('@/lib/supabase');

const USER_WORDS_CACHE_KEY = 'vocabulary-user-words';
const USER = 'user-1';

beforeEach(async () => {
  __reset();
  await AsyncStorage.clear();
});

describe('slug', () => {
  it('lowercases, collapses non-alphanumeric runs to one dash, and trims edges', () => {
    expect(slug('  Farm-to-Table!! ')).toBe('farm-to-table');
    expect(slug('C++ & Rust')).toBe('c-rust');
    expect(slug('gravitas')).toBe('gravitas');
  });

  it('returns an empty string when there are no alphanumerics', () => {
    expect(slug('!!!')).toBe('');
    expect(slug('   ')).toBe('');
  });
});

describe('getUserWords', () => {
  it('returns [] when there is no session', async () => {
    await expect(getUserWords()).resolves.toEqual([]);
  });

  it('reads the user rows from Supabase and refreshes the cache', async () => {
    __setUser(USER);
    __db.user_words.push({
      user_id: USER,
      id: 'user-poise',
      word: 'poise',
      definition: 'composure',
      category: 'academic',
    });

    await expect(getUserWords()).resolves.toEqual([
      { id: 'user-poise', word: 'poise', definition: 'composure', category: 'academic' },
    ]);
    const cached = JSON.parse((await AsyncStorage.getItem(USER_WORDS_CACHE_KEY)) ?? 'null');
    expect(cached).toEqual([
      { id: 'user-poise', word: 'poise', definition: 'composure', category: 'academic' },
    ]);
  });

  it('falls back to the cache when the request fails', async () => {
    __setUser(USER);
    await AsyncStorage.setItem(
      USER_WORDS_CACHE_KEY,
      JSON.stringify([{ id: 'user-x', word: 'x', definition: 'd', category: 'academic' }]),
    );
    __setOffline(true);

    await expect(getUserWords()).resolves.toEqual([
      { id: 'user-x', word: 'x', definition: 'd', category: 'academic' },
    ]);
  });

  it('throws UserWordsReadError on a corrupt cache while offline', async () => {
    __setUser(USER);
    await AsyncStorage.setItem(USER_WORDS_CACHE_KEY, 'not json {');
    __setOffline(true);
    await expect(getUserWords()).rejects.toBeInstanceOf(UserWordsReadError);
  });
});

describe('addUserWord', () => {
  it('persists a new card for the user and returns it', async () => {
    __setUser(USER);
    const result = await addUserWord({
      word: 'gravitas',
      definition: 'a serious, dignified manner',
      category: 'academic',
    });

    expect(result).toEqual({
      ok: true,
      word: {
        id: 'user-gravitas',
        word: 'gravitas',
        definition: 'a serious, dignified manner',
        category: 'academic',
      },
    });
    expect(__db.user_words).toEqual([
      {
        user_id: USER,
        id: 'user-gravitas',
        word: 'gravitas',
        definition: 'a serious, dignified manner',
        category: 'academic',
      },
    ]);
  });

  it('trims the word and definition', async () => {
    __setUser(USER);
    await addUserWord({ word: '  poise  ', definition: '  calm  ', category: 'academic' });
    expect(__db.user_words[0]).toMatchObject({ id: 'user-poise', word: 'poise', definition: 'calm' });
  });

  it('rejects blank / slug-to-empty as "empty" — before touching the session', async () => {
    await expect(
      addUserWord({ word: '   ', definition: 'd', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'empty' });
    await expect(
      addUserWord({ word: '!!!', definition: 'd', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a word already in the seed deck as "duplicate"', async () => {
    __setUser(USER);
    await expect(
      addUserWord({ word: SEED_VOCABULARY[0].word, definition: 'mine', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'duplicate' });
  });

  it('rejects a word the user already added as "duplicate"', async () => {
    __setUser(USER);
    await addUserWord({ word: 'gravitas', definition: 'first', category: 'academic' });
    await expect(
      addUserWord({ word: 'Gravitas', definition: 'second', category: 'business' }),
    ).resolves.toEqual({ ok: false, reason: 'duplicate' });
    expect(__db.user_words).toHaveLength(1);
  });

  it('returns "offline" with no session', async () => {
    await expect(
      addUserWord({ word: 'gravitas', definition: 'd', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'offline' });
  });

  it('returns "offline" on a network failure', async () => {
    __setUser(USER);
    __setOffline(true);
    await expect(
      addUserWord({ word: 'gravitas', definition: 'd', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'offline' });
  });
});

describe('updateUserWord', () => {
  it('changes definition + category, keeps id and word', async () => {
    __setUser(USER);
    await addUserWord({ word: 'gravitas', definition: 'old', category: 'academic' });

    await expect(
      updateUserWord('user-gravitas', { definition: 'new', category: 'business' }),
    ).resolves.toEqual({ ok: true });
    expect(__db.user_words[0]).toEqual({
      user_id: USER,
      id: 'user-gravitas',
      word: 'gravitas',
      definition: 'new',
      category: 'business',
    });
  });

  it('rejects an unknown id as "not-found"', async () => {
    __setUser(USER);
    await expect(
      updateUserWord('user-nope', { definition: 'x', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'not-found' });
  });

  it('rejects a blank definition as "empty"', async () => {
    __setUser(USER);
    await addUserWord({ word: 'gravitas', definition: 'old', category: 'academic' });
    await expect(
      updateUserWord('user-gravitas', { definition: '   ', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'empty' });
    expect(__db.user_words[0].definition).toBe('old');
  });

  it('returns "offline" with no session', async () => {
    await expect(
      updateUserWord('user-gravitas', { definition: 'x', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'offline' });
  });
});

describe('deleteUserWord', () => {
  it('removes only the target card', async () => {
    __setUser(USER);
    await addUserWord({ word: 'alpha', definition: 'a', category: 'academic' });
    await addUserWord({ word: 'beta', definition: 'b', category: 'academic' });

    await expect(deleteUserWord('user-alpha')).resolves.toEqual({ ok: true });
    expect(__db.user_words.map((r) => r.id)).toEqual(['user-beta']);
  });

  it('is a success for an id that is not present', async () => {
    __setUser(USER);
    await expect(deleteUserWord('user-missing')).resolves.toEqual({ ok: true });
  });

  it('returns "offline" with no session', async () => {
    await expect(deleteUserWord('user-x')).resolves.toEqual({ ok: false, reason: 'offline' });
  });
});
