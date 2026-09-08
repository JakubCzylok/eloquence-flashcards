import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';

import { SEED_VOCABULARY } from '@/constants/vocabulary';
import {
  addUserWord,
  deleteUserWord,
  getUserWords,
  slug,
  updateUserWord,
  UserWordsReadError,
} from '@/lib/user-vocabulary';

const USER_WORDS_KEY = 'vocabulary-user-words';

beforeEach(async () => {
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
  it('returns [] when the key has never been written', async () => {
    await expect(getUserWords()).resolves.toEqual([]);
  });

  it('round-trips a stored array of cards', async () => {
    const cards = [
      { id: 'user-poise', word: 'poise', definition: 'composure', category: 'academic' },
    ];
    await AsyncStorage.setItem(USER_WORDS_KEY, JSON.stringify(cards));
    await expect(getUserWords()).resolves.toEqual(cards);
  });

  it('throws UserWordsReadError on an unparseable value — does not swallow to []', async () => {
    await AsyncStorage.setItem(USER_WORDS_KEY, 'not json {');
    await expect(getUserWords()).rejects.toBeInstanceOf(UserWordsReadError);
  });

  it('throws UserWordsReadError when the stored JSON is not an array of cards', async () => {
    await AsyncStorage.setItem(USER_WORDS_KEY, JSON.stringify({ not: 'an array' }));
    await expect(getUserWords()).rejects.toBeInstanceOf(UserWordsReadError);
  });
});

describe('addUserWord', () => {
  it('persists a new card and returns it', async () => {
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
    const stored = await getUserWords();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('user-gravitas');
  });

  it('trims the word and definition before storing', async () => {
    const result = await addUserWord({
      word: '  poise  ',
      definition: '  calm self-possession  ',
      category: 'academic',
    });

    expect(result.ok).toBe(true);
    const [stored] = await getUserWords();
    expect(stored.word).toBe('poise');
    expect(stored.definition).toBe('calm self-possession');
    expect(stored.id).toBe('user-poise');
  });

  it('rejects a blank word or definition as "empty"', async () => {
    await expect(
      addUserWord({ word: '   ', definition: 'd', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'empty' });
    await expect(
      addUserWord({ word: 'w', definition: '   ', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'empty' });
    await expect(getUserWords()).resolves.toEqual([]);
  });

  it('rejects a word that slugs to empty as "empty"', async () => {
    await expect(
      addUserWord({ word: '!!!', definition: 'd', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a word already in the seed deck as "duplicate"', async () => {
    const seedWord = SEED_VOCABULARY[0].word;
    await expect(
      addUserWord({ word: seedWord, definition: 'my own take', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'duplicate' });
  });

  it('rejects a word already added by the user as "duplicate"', async () => {
    await addUserWord({ word: 'gravitas', definition: 'first', category: 'academic' });
    await expect(
      addUserWord({ word: 'Gravitas', definition: 'second', category: 'business' }),
    ).resolves.toEqual({ ok: false, reason: 'duplicate' });
    expect(await getUserWords()).toHaveLength(1);
  });

  it('serializes overlapping adds without dropping any', async () => {
    await Promise.all([
      addUserWord({ word: 'alpha', definition: 'a', category: 'academic' }),
      addUserWord({ word: 'beta', definition: 'b', category: 'academic' }),
      addUserWord({ word: 'gamma', definition: 'c', category: 'academic' }),
    ]);
    const ids = (await getUserWords()).map((w) => w.id).sort();
    expect(ids).toEqual(['user-alpha', 'user-beta', 'user-gamma']);
  });
});

describe('updateUserWord', () => {
  it('changes definition and category but keeps id and word', async () => {
    await addUserWord({ word: 'gravitas', definition: 'old', category: 'academic' });

    const result = await updateUserWord('user-gravitas', {
      definition: 'new',
      category: 'business',
    });

    expect(result).toEqual({ ok: true });
    const [stored] = await getUserWords();
    expect(stored).toEqual({
      id: 'user-gravitas',
      word: 'gravitas',
      definition: 'new',
      category: 'business',
    });
  });

  it('rejects an unknown id as "not-found"', async () => {
    await expect(
      updateUserWord('user-nope', { definition: 'x', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'not-found' });
  });

  it('rejects a blank definition as "empty"', async () => {
    await addUserWord({ word: 'gravitas', definition: 'old', category: 'academic' });
    await expect(
      updateUserWord('user-gravitas', { definition: '   ', category: 'academic' }),
    ).resolves.toEqual({ ok: false, reason: 'empty' });
    expect((await getUserWords())[0].definition).toBe('old');
  });
});

describe('deleteUserWord', () => {
  it('removes only the target card', async () => {
    await addUserWord({ word: 'alpha', definition: 'a', category: 'academic' });
    await addUserWord({ word: 'beta', definition: 'b', category: 'academic' });

    await deleteUserWord('user-alpha');

    const ids = (await getUserWords()).map((w) => w.id);
    expect(ids).toEqual(['user-beta']);
  });

  it('is a no-op for an id that is not present', async () => {
    await addUserWord({ word: 'alpha', definition: 'a', category: 'academic' });
    await deleteUserWord('user-missing');
    expect(await getUserWords()).toHaveLength(1);
  });
});
