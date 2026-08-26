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

export async function setWordKnownState(wordId: string, known: boolean): Promise<void> {
  const currentState = await getKnownState();
  const nextState = { ...currentState, [wordId]: known };
  await AsyncStorage.setItem(KNOWN_STATE_KEY, JSON.stringify(nextState));
}
