import AsyncStorage from '@react-native-async-storage/async-storage';

import { SEED_VOCABULARY, VocabularyCategory, VocabularyWord } from '@/constants/vocabulary';
import { currentUserId, requireUserId, supabase } from '@/lib/supabase';

// Per-device READ CACHE of the signed-in user's `user_words` rows. Source of
// truth is Supabase; this key only backs offline reads.
const USER_WORDS_CACHE_KEY = 'vocabulary-user-words';

/**
 * Raised only when the local user-words **cache** exists but cannot be read
 * back as a usable array. A remote/network failure is NOT this — it falls back
 * to the cache.
 */
export class UserWordsReadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UserWordsReadError';
  }
}

export type AddUserWordInput = {
  word: string;
  definition: string;
  category: VocabularyCategory;
};

export type AddUserWordResult =
  | { ok: true; word: VocabularyWord }
  | { ok: false; reason: 'empty' | 'duplicate' | 'offline' };

export type UpdateUserWordInput = {
  definition: string;
  category: VocabularyCategory;
};

export type UpdateUserWordResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'empty' | 'offline' };

export type DeleteUserWordResult = { ok: true } | { ok: false; reason: 'offline' };

function isVocabularyWordArray(value: unknown): value is VocabularyWord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as VocabularyWord).id === 'string' &&
        typeof (entry as VocabularyWord).word === 'string' &&
        typeof (entry as VocabularyWord).definition === 'string' &&
        typeof (entry as VocabularyWord).category === 'string',
    )
  );
}

/**
 * Lowercase, collapse every run of non-alphanumeric characters to a single `-`,
 * and trim leading/trailing `-`. A word that is entirely non-alphanumeric slugs
 * to `''`.
 */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function readUserWordsCache(): Promise<VocabularyWord[]> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(USER_WORDS_CACHE_KEY);
  } catch (cause) {
    throw new UserWordsReadError('Could not read your saved cards from storage.', { cause });
  }
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new UserWordsReadError('Your saved cards are corrupted and could not be read.', {
      cause,
    });
  }
  if (!isVocabularyWordArray(parsed)) {
    throw new UserWordsReadError('Your saved cards are in an unexpected format.');
  }
  return parsed;
}

async function writeUserWordsCache(words: VocabularyWord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_WORDS_CACHE_KEY, JSON.stringify(words));
  } catch {
    // best-effort
  }
}

function toWord(row: Record<string, unknown>): VocabularyWord {
  return {
    id: row.id as string,
    word: row.word as string,
    definition: row.definition as string,
    category: row.category as VocabularyCategory,
  };
}

/**
 * The signed-in user's own cards. Reads Supabase; on success refreshes the
 * local cache; on a network/auth error falls back to the cache (`[]` if none).
 * Returns `[]` with no session.
 */
export async function getUserWords(): Promise<VocabularyWord[]> {
  const userId = await currentUserId();
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_words')
    .select('id, word, definition, category')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return readUserWordsCache();
  }

  const words = (data as Record<string, unknown>[]).map(toWord);
  await writeUserWordsCache(words);
  return words;
}

/**
 * Create a card for the signed-in user. `word`/`definition` are trimmed; a blank
 * one (or a `word` that slugs to empty) is `'empty'`. A word already in the seed
 * deck or already added by this user is `'duplicate'`. No session / a network
 * failure is `'offline'`. The word is immutable once created.
 */
export async function addUserWord(input: AddUserWordInput): Promise<AddUserWordResult> {
  const word = input.word.trim();
  const definition = input.definition.trim();
  if (!word || !definition) {
    return { ok: false, reason: 'empty' };
  }
  const wordSlug = slug(word);
  if (!wordSlug) {
    return { ok: false, reason: 'empty' };
  }
  if (SEED_VOCABULARY.some((seed) => seed.id === wordSlug)) {
    return { ok: false, reason: 'duplicate' };
  }
  const id = `user-${wordSlug}`;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, reason: 'offline' };
  }

  const existing = await supabase
    .from('user_words')
    .select('id')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (existing.error) {
    return { ok: false, reason: 'offline' };
  }
  if (existing.data) {
    return { ok: false, reason: 'duplicate' };
  }

  const created: VocabularyWord = { id, word, definition, category: input.category };
  const { error } = await supabase.from('user_words').insert({ user_id: userId, ...created });
  if (error) {
    return { ok: false, reason: 'offline' };
  }

  try {
    await writeUserWordsCache([...(await readUserWordsCache()), created]);
  } catch {
    // best-effort
  }
  return { ok: true, word: created };
}

/**
 * Update a card's definition and category (word/id immutable). Blank definition
 * is `'empty'`; no such card for this user is `'not-found'`; no session / network
 * failure is `'offline'`.
 */
export async function updateUserWord(
  id: string,
  input: UpdateUserWordInput,
): Promise<UpdateUserWordResult> {
  const definition = input.definition.trim();
  if (!definition) {
    return { ok: false, reason: 'empty' };
  }

  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, reason: 'offline' };
  }

  const { data, error } = await supabase
    .from('user_words')
    .update({ definition, category: input.category })
    .eq('user_id', userId)
    .eq('id', id)
    .select('id');
  if (error) {
    return { ok: false, reason: 'offline' };
  }
  if (!data || (data as unknown[]).length === 0) {
    return { ok: false, reason: 'not-found' };
  }

  try {
    const cache = await readUserWordsCache();
    await writeUserWordsCache(
      cache.map((existing) =>
        existing.id === id ? { ...existing, definition, category: input.category } : existing,
      ),
    );
  } catch {
    // best-effort
  }
  return { ok: true };
}

/**
 * Delete a card. No session / a network failure is `'offline'`. A missing card
 * is treated as success (nothing to remove). Known/unknown state keyed by the id
 * is intentionally left in place.
 */
export async function deleteUserWord(id: string): Promise<DeleteUserWordResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, reason: 'offline' };
  }

  const { error } = await supabase
    .from('user_words')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) {
    return { ok: false, reason: 'offline' };
  }

  try {
    const cache = await readUserWordsCache();
    await writeUserWordsCache(cache.filter((existing) => existing.id !== id));
  } catch {
    // best-effort
  }
  return { ok: true };
}
