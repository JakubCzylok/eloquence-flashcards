import AsyncStorage from '@react-native-async-storage/async-storage';

import { VocabularyCategory, VocabularyWord } from '@/constants/vocabulary';
import { supabase } from '@/lib/supabase';

// Set once, per device, after the on-device data that predates auth has been
// pushed into whichever account signed in first. After that the two legacy keys
// are only ever the per-user read cache (see vocabulary-store.ts).
const MIGRATED_FLAG_KEY = 'vocabulary-local-migrated';
const LEGACY_KNOWN_STATE_KEY = 'vocabulary-known-state';
const LEGACY_USER_WORDS_KEY = 'vocabulary-user-words';

function parseKnownMap(raw: string | null): Record<string, boolean> {
  if (!raw) {
    return {};
  }
  try {
    const value = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }
    const out: Record<string, boolean> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === 'boolean') {
        out[key] = entry;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function parseUserWords(raw: string | null): VocabularyWord[] {
  if (!raw) {
    return [];
  }
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(
      (entry): entry is VocabularyWord =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.id === 'string' &&
        typeof entry.word === 'string' &&
        typeof entry.definition === 'string' &&
        typeof entry.category === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Once per device: if the on-device known-state / user-cards keys hold data
 * from before auth existed, push it into `userId`'s account (on id conflict the
 * existing account row wins), then set the migrated flag.
 *
 * Idempotent (the flag short-circuits a second call). On failure the flag is
 * left unset so the next sign-in retries, and the error is rethrown so the
 * caller can log it — but the caller must not let it block the app.
 */
export async function migrateLocalDataIfNeeded(userId: string): Promise<void> {
  if (await AsyncStorage.getItem(MIGRATED_FLAG_KEY)) {
    return;
  }

  const knownMap = parseKnownMap(await AsyncStorage.getItem(LEGACY_KNOWN_STATE_KEY));
  const userWords = parseUserWords(await AsyncStorage.getItem(LEGACY_USER_WORDS_KEY));

  const knownEntries = Object.entries(knownMap);
  if (knownEntries.length > 0) {
    const { error } = await supabase.from('known_state').upsert(
      knownEntries.map(([wordId, known]) => ({ user_id: userId, word_id: wordId, known })),
      { onConflict: 'user_id,word_id', ignoreDuplicates: true },
    );
    if (error) {
      throw new Error(`known_state migration failed: ${error.message}`);
    }
  }

  if (userWords.length > 0) {
    const { error } = await supabase.from('user_words').upsert(
      userWords.map((word) => ({
        user_id: userId,
        id: word.id,
        word: word.word,
        definition: word.definition,
        category: word.category as VocabularyCategory,
      })),
      { onConflict: 'user_id,id', ignoreDuplicates: true },
    );
    if (error) {
      throw new Error(`user_words migration failed: ${error.message}`);
    }
  }

  await AsyncStorage.setItem(MIGRATED_FLAG_KEY, '1');
}
