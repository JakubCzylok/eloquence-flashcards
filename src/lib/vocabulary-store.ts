import AsyncStorage from '@react-native-async-storage/async-storage';

import { SEED_VOCABULARY, VocabularyWord } from '@/constants/vocabulary';
import { currentUserId, requireUserId, supabase } from '@/lib/supabase';
import { getUserWords } from '@/lib/user-vocabulary';

// Per-device READ CACHE of the signed-in user's `known_state` rows. Source of
// truth is Supabase; this key is only a fallback so the ranking loop still
// renders offline after a prior online load.
const KNOWN_STATE_CACHE_KEY = 'vocabulary-known-state';

export function getSeedVocabulary(): VocabularyWord[] {
  return SEED_VOCABULARY;
}

/**
 * The whole deck the loop screen ranks against: the seed words first, in seed
 * order, then the user-authored cards. Propagates `UserWordsReadError` from
 * `getUserWords()`.
 */
export async function getAllVocabulary(): Promise<VocabularyWord[]> {
  return [...getSeedVocabulary(), ...(await getUserWords())];
}

/**
 * Raised only when the local known-state **cache** exists but cannot be read
 * back as a usable map (AsyncStorage rejected, corrupt JSON, wrong shape). A
 * remote/network failure is NOT this — it falls back to the cache.
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

async function readKnownStateCache(): Promise<Record<string, boolean>> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(KNOWN_STATE_CACHE_KEY);
  } catch (cause) {
    throw new KnownStateReadError('Could not read your saved words from storage.', { cause });
  }
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

async function writeKnownStateCache(map: Record<string, boolean>): Promise<void> {
  try {
    await AsyncStorage.setItem(KNOWN_STATE_CACHE_KEY, JSON.stringify(map));
  } catch {
    // cache write is best-effort — the DB already has the truth
  }
}

/**
 * The signed-in user's known/unknown map. Reads Supabase; on success refreshes
 * the local cache and returns the fresh map; on a network/auth error falls back
 * to the last cached map (`{}` if there is none). Returns `{}` with no session
 * (the gate keeps this from being shown anyway).
 */
export async function getKnownState(): Promise<Record<string, boolean>> {
  const userId = await currentUserId();
  if (!userId) {
    return {};
  }

  const { data, error } = await supabase
    .from('known_state')
    .select('word_id, known')
    .eq('user_id', userId);

  if (error || !data) {
    return readKnownStateCache();
  }

  const map: Record<string, boolean> = {};
  for (const row of data as { word_id: string; known: boolean }[]) {
    map[row.word_id] = row.known;
  }
  await writeKnownStateCache(map);
  return map;
}

/**
 * Persist one word's known/unknown flag for the signed-in user. Online-only:
 * throws `NotAuthenticatedError` with no session, or a plain error on a network
 * failure — `index.tsx`'s mark handler surfaces both and skips the optimistic
 * update. The local cache is patched on success.
 */
export async function setWordKnownState(wordId: string, known: boolean): Promise<void> {
  const userId = await requireUserId();

  const { error } = await supabase
    .from('known_state')
    .upsert({ user_id: userId, word_id: wordId, known }, { onConflict: 'user_id,word_id' });

  if (error) {
    throw new Error("Couldn't save that — you may be offline. Try again.");
  }

  try {
    const cached = await readKnownStateCache();
    await writeKnownStateCache({ ...cached, [wordId]: known });
  } catch {
    // cache patch is best-effort
  }
}
