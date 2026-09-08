import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Flashcard } from '@/components/flashcard';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { VocabularyWord } from '@/constants/vocabulary';
import { rankVocabulary } from '@/lib/vocabulary-ranking';
import { getKnownState, setWordKnownState } from '@/lib/vocabulary-store';

type Phase = 'input' | 'card' | 'done';

const PLACEHOLDER = 'e.g. my girlfriend’s dad, a retired history teacher who races bikes';

export default function HomeScreen() {
  const [phase, setPhase] = useState<Phase>('input');
  const [description, setDescription] = useState('');
  const [queue, setQueue] = useState<VocabularyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [knownState, setKnownState] = useState<Record<string, boolean>>({});
  const markingRef = useRef(false);

  const loadKnownState = useCallback(() => {
    getKnownState().then(setKnownState);
  }, []);

  useEffect(() => {
    loadKnownState();
  }, [loadKnownState]);

  const trimmed = description.trim();

  const handleSubmit = useCallback(() => {
    if (!trimmed) {
      return;
    }
    setQueue(rankVocabulary(trimmed, knownState));
    setIndex(0);
    setPhase('card');
  }, [trimmed, knownState]);

  const handleMark = useCallback(
    async (known: boolean) => {
      if (markingRef.current) {
        return;
      }
      const word = queue[index];
      if (!word) {
        return;
      }
      markingRef.current = true;
      try {
        await setWordKnownState(word.id, known);
      } finally {
        markingRef.current = false;
      }
      setKnownState((prev) => ({ ...prev, [word.id]: known }));
      if (index + 1 >= queue.length) {
        setPhase('done');
      } else {
        setIndex(index + 1);
      }
    },
    [queue, index],
  );

  const startNewDescription = useCallback(() => {
    setQueue([]);
    setIndex(0);
    setPhase('input');
  }, []);

  const currentWord = queue[index];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea}>
          {phase === 'input' && (
          <ThemedView style={styles.inputBlock}>
            <ThemedText type="title" style={styles.heading}>
              Who are you about to talk to?
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Describe the person and their interests. You’ll get a word ranked for that
              conversation.
            </ThemedText>
            <ThemedTextInput
              value={description}
              onChangeText={setDescription}
              placeholder={PLACEHOLDER}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
            <Pressable onPress={handleSubmit} disabled={!trimmed}>
              <ThemedView
                type={trimmed ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.submitButton}>
                <ThemedText type="smallBold">Show me a word</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>
        )}

        {phase === 'card' && currentWord && (
          <ThemedView style={styles.cardBlock}>
            <Flashcard
              word={currentWord}
              known={knownState[currentWord.id]}
              onMark={handleMark}
            />
            <Pressable onPress={startNewDescription}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.textLink}>
                New description
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {phase === 'done' && (
          <ThemedView style={styles.inputBlock}>
            <ThemedText type="title" style={styles.heading}>
              That’s every word for this description.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Start a new one to practise for a different conversation.
            </ThemedText>
            <Pressable onPress={startNewDescription}>
              <ThemedView type="backgroundSelected" style={styles.submitButton}>
                <ThemedText type="smallBold">New description</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>
        )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  inputBlock: {
    gap: Spacing.three,
  },
  cardBlock: {
    gap: Spacing.three,
    alignItems: 'center',
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
  },
  submitButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  textLink: {
    paddingVertical: Spacing.two,
  },
});
