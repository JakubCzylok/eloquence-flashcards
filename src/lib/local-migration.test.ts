import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { migrateLocalDataIfNeeded } from '@/lib/local-migration';

jest.mock('@/lib/supabase');
const { __db, __reset, __setOffline } =
  jest.requireMock<typeof import('@/lib/__mocks__/supabase')>('@/lib/supabase');

const FLAG = 'vocabulary-local-migrated';
const KNOWN = 'vocabulary-known-state';
const WORDS = 'vocabulary-user-words';
const USER = 'user-1';

beforeEach(async () => {
  __reset();
  await AsyncStorage.clear();
});

describe('migrateLocalDataIfNeeded', () => {
  it('uploads the on-device known-state and user cards, then sets the flag', async () => {
    await AsyncStorage.setItem(KNOWN, JSON.stringify({ acumen: true, synergy: false }));
    await AsyncStorage.setItem(
      WORDS,
      JSON.stringify([
        { id: 'user-gravitas', word: 'gravitas', definition: 'dignity', category: 'academic' },
      ]),
    );

    await migrateLocalDataIfNeeded(USER);

    expect(__db.known_state).toEqual(
      expect.arrayContaining([
        { user_id: USER, word_id: 'acumen', known: true },
        { user_id: USER, word_id: 'synergy', known: false },
      ]),
    );
    expect(__db.user_words).toEqual([
      {
        user_id: USER,
        id: 'user-gravitas',
        word: 'gravitas',
        definition: 'dignity',
        category: 'academic',
      },
    ]);
    expect(await AsyncStorage.getItem(FLAG)).toBe('1');
  });

  it('is a no-op on a second call (flag already set)', async () => {
    await AsyncStorage.setItem(KNOWN, JSON.stringify({ acumen: true }));
    await migrateLocalDataIfNeeded(USER);

    __db.known_state.length = 0;
    __db.user_words.length = 0;
    await migrateLocalDataIfNeeded(USER);

    expect(__db.known_state).toHaveLength(0);
    expect(__db.user_words).toHaveLength(0);
  });

  it('keeps the existing account row on an id conflict', async () => {
    __db.user_words.push({
      user_id: USER,
      id: 'user-gravitas',
      word: 'gravitas',
      definition: 'the account version',
      category: 'academic',
    });
    await AsyncStorage.setItem(
      WORDS,
      JSON.stringify([
        { id: 'user-gravitas', word: 'gravitas', definition: 'the local version', category: 'business' },
      ]),
    );

    await migrateLocalDataIfNeeded(USER);

    expect(__db.user_words).toEqual([
      {
        user_id: USER,
        id: 'user-gravitas',
        word: 'gravitas',
        definition: 'the account version',
        category: 'academic',
      },
    ]);
  });

  it('leaves the flag unset and rethrows when the upload fails', async () => {
    await AsyncStorage.setItem(KNOWN, JSON.stringify({ acumen: true }));
    __setOffline(true);

    await expect(migrateLocalDataIfNeeded(USER)).rejects.toThrow();
    expect(await AsyncStorage.getItem(FLAG)).toBeNull();

    __setOffline(false);
    await migrateLocalDataIfNeeded(USER);
    expect(await AsyncStorage.getItem(FLAG)).toBe('1');
    expect(__db.known_state).toEqual([{ user_id: USER, word_id: 'acumen', known: true }]);
  });

  it('sets the flag with nothing to migrate (so it does not retry every sign-in)', async () => {
    await migrateLocalDataIfNeeded(USER);
    expect(await AsyncStorage.getItem(FLAG)).toBe('1');
    expect(__db.known_state).toHaveLength(0);
    expect(__db.user_words).toHaveLength(0);
  });
});
