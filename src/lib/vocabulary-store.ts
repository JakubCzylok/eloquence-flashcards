import AsyncStorage from '@react-native-async-storage/async-storage';

import { SEED_VOCABULARY, VocabularyWord } from '@/constants/vocabulary';

const KNOWN_STATE_KEY = 'vocabulary-known-state';

export function getSeedVocabulary(): VocabularyWord[] {
  return SEED_VOCABULARY;
}

export async function getKnownState(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(KNOWN_STATE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

// Serialize known-state writes. Read-merge-write is not atomic on its own, so
// overlapping calls are chained — no entry can clobber another.
let writeQueue: Promise<void> = Promise.resolve();

export function setWordKnownState(wordId: string, known: boolean): Promise<void> {
  const run = writeQueue.then(async () => {
    const currentState = await getKnownState();
    const nextState = { ...currentState, [wordId]: known };
    await AsyncStorage.setItem(KNOWN_STATE_KEY, JSON.stringify(nextState));
  });
  // Keep the queue alive even if this write fails; callers still see the rejection via `run`.
  writeQueue = run.catch(() => {});
  return run;
}
