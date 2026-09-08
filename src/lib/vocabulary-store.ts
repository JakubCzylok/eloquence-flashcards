import AsyncStorage from '@react-native-async-storage/async-storage';

import { SEED_VOCABULARY, VocabularyWord } from '@/constants/vocabulary';
import { getUserWords } from '@/lib/user-vocabulary';

const KNOWN_STATE_KEY = 'vocabulary-known-state';

export function getSeedVocabulary(): VocabularyWord[] {
  return SEED_VOCABULARY;
}

/**
 * The whole deck the loop screen ranks against: the seed words first, in seed
 * order, then the user-authored cards. Propagates `UserWordsReadError` from
 * `getUserWords()` — a corrupt user-word store must surface, not silently drop
 * the custom cards.
 */
export async function getAllVocabulary(): Promise<VocabularyWord[]> {
  return [...getSeedVocabulary(), ...(await getUserWords())];
}

/**
 * Raised when persisted known-state exists but cannot be read back as a usable
 * map: AsyncStorage rejected, the stored JSON is corrupt, or its shape is not a
 * string→boolean object.
 *
 * This must propagate — it must NOT be flattened to an empty map. An empty map
 * here is indistinguishable from "first run", so the UI would silently show the
 * user as having learned nothing, and the very next setWordKnownState() would
 * then overwrite the whole stored map with a single key.
 */
export class KnownStateReadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'KnownStateReadError';
  }
}

function isKnownStateShape(value: unknown): value is Record<string, boolean> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === 'boolean');
}

export async function getKnownState(): Promise<Record<string, boolean>> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(KNOWN_STATE_KEY);
  } catch (cause) {
    throw new KnownStateReadError('Could not read your saved words from storage.', { cause });
  }

  // The only case that legitimately yields an empty map: nothing stored yet.
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new KnownStateReadError('Your saved words are corrupted and could not be read.', {
      cause,
    });
  }

  if (!isKnownStateShape(parsed)) {
    throw new KnownStateReadError('Your saved words are in an unexpected format.');
  }

  return parsed;
}

// Serialize known-state writes. Read-merge-write is not atomic on its own, so
// overlapping calls are chained — no entry can clobber another.
let writeQueue: Promise<void> = Promise.resolve();

export function setWordKnownState(wordId: string, known: boolean): Promise<void> {
  const run = writeQueue.then(async () => {
    // Read-before-write: if getKnownState() throws (storage error / corrupt
    // data) this rejects HERE, before setItem — so a failed read can no longer
    // overwrite the whole map with just this one key. The rejection reaches the
    // caller via `run`.
    const currentState = await getKnownState();
    const nextState = { ...currentState, [wordId]: known };
    await AsyncStorage.setItem(KNOWN_STATE_KEY, JSON.stringify(nextState));
  });
  // Keep the queue alive even if this write fails; callers still see the rejection via `run`.
  writeQueue = run.catch(() => {});
  return run;
}
