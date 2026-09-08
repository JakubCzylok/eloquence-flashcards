import AsyncStorage from '@react-native-async-storage/async-storage';

import { SEED_VOCABULARY, VocabularyCategory, VocabularyWord } from '@/constants/vocabulary';

const USER_WORDS_KEY = 'vocabulary-user-words';

/**
 * Raised when persisted user words exist but cannot be read back as a usable
 * array: AsyncStorage rejected, the stored JSON is corrupt, or its shape is not
 * an array of `{ id, word, definition, category }`.
 *
 * Mirrors `KnownStateReadError` in `vocabulary-store.ts`: it must propagate, not
 * flatten to `[]`. An empty array here is indistinguishable from "no custom
 * cards yet", so the manage view would show nothing and the very next
 * `addUserWord()` would overwrite the whole list with a single card.
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
  | { ok: false; reason: 'empty' | 'duplicate' };

export type UpdateUserWordInput = {
  definition: string;
  category: VocabularyCategory;
};

export type UpdateUserWordResult = { ok: true } | { ok: false; reason: 'not-found' | 'empty' };

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
 * and trim leading/trailing `-`. Used to derive a stable id from a word.
 * A word that is entirely non-alphanumeric slugs to `''`.
 */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Read the user-authored cards. Returns `[]` only when the key has never been
 * written. A storage rejection, unparseable JSON, or a non-array/mis-shaped
 * value throws `UserWordsReadError` — see the class doc for why this must not be
 * swallowed to `[]`.
 */
export async function getUserWords(): Promise<VocabularyWord[]> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(USER_WORDS_KEY);
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

// Serialize user-word writes. add/update/delete each do read-modify-write, which
// is not atomic on its own, so overlapping calls are chained through this queue.
// A failed task still resolves the queue (so a later call is not stuck) but its
// rejection reaches that call's own caller.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function persist(words: VocabularyWord[]): Promise<void> {
  await AsyncStorage.setItem(USER_WORDS_KEY, JSON.stringify(words));
}

/**
 * Append a new user card. `word` and `definition` are trimmed; either blank (or
 * a `word` that slugs to empty) is rejected as `'empty'`. The id is
 * `user-<slug(word)>`; a collision with a seed id or an existing user id is
 * rejected as `'duplicate'`. The word is immutable once created (see
 * `updateUserWord`).
 */
export function addUserWord(input: AddUserWordInput): Promise<AddUserWordResult> {
  const word = input.word.trim();
  const definition = input.definition.trim();
  if (!word || !definition) {
    return Promise.resolve({ ok: false, reason: 'empty' });
  }
  const wordSlug = slug(word);
  if (!wordSlug) {
    return Promise.resolve({ ok: false, reason: 'empty' });
  }
  const id = `user-${wordSlug}`;

  return enqueue(async () => {
    // Seed ids are the bare slug of the seed word; a user id is `user-<slug>`.
    // Compare the slug so "add a word already in the seed deck" is caught as a
    // duplicate rather than creating a second card for the same word.
    if (SEED_VOCABULARY.some((seed) => seed.id === wordSlug)) {
      return { ok: false, reason: 'duplicate' };
    }
    const words = await getUserWords();
    if (words.some((existing) => existing.id === id)) {
      return { ok: false, reason: 'duplicate' };
    }
    const created: VocabularyWord = { id, word, definition, category: input.category };
    await persist([...words, created]);
    return { ok: true, word: created };
  });
}

/**
 * Update an existing user card's definition and category. The `word` and `id`
 * are immutable. A blank definition is rejected as `'empty'`; no user card with
 * that id is rejected as `'not-found'`.
 */
export function updateUserWord(
  id: string,
  input: UpdateUserWordInput,
): Promise<UpdateUserWordResult> {
  const definition = input.definition.trim();
  if (!definition) {
    return Promise.resolve({ ok: false, reason: 'empty' });
  }

  return enqueue(async () => {
    const words = await getUserWords();
    const index = words.findIndex((existing) => existing.id === id);
    if (index === -1) {
      return { ok: false, reason: 'not-found' };
    }
    const next = words.map((existing, i) =>
      i === index ? { ...existing, definition, category: input.category } : existing,
    );
    await persist(next);
    return { ok: true };
  });
}

/**
 * Remove a user card. No-op if no user card has that id. Known/unknown state and
 * mark history keyed by the id are intentionally left in place — re-adding an
 * identical word recovers them.
 */
export function deleteUserWord(id: string): Promise<void> {
  return enqueue(async () => {
    const words = await getUserWords();
    const next = words.filter((existing) => existing.id !== id);
    if (next.length !== words.length) {
      await persist(next);
    }
  });
}
