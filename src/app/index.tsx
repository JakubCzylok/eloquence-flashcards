import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Flashcard } from '@/components/flashcard';
import { ManageCards } from '@/components/manage-cards';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { SEED_VOCABULARY, VocabularyWord } from '@/constants/vocabulary';
import {
  addUserWord,
  AddUserWordInput,
  deleteUserWord,
  updateUserWord,
  UpdateUserWordInput,
} from '@/lib/user-vocabulary';
import { useAuth } from '@/lib/auth-context';
import { rankVocabulary } from '@/lib/vocabulary-ranking';
import { getAllVocabulary, getKnownState, setWordKnownState } from '@/lib/vocabulary-store';

type Phase = 'input' | 'card' | 'done' | 'manage';

const PLACEHOLDER = 'e.g. my girlfriend’s dad, a retired history teacher who races bikes';

const errText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function HomeScreen() {
  // The auth gate in _layout.tsx only mounts this screen with a session, and
  // remounts it when the signed-in user changes — so the mount effect below is
  // the per-user store load.
  const { signOut } = useAuth();
  const [phase, setPhase] = useState<Phase>('input');
  const [description, setDescription] = useState('');
  const [queue, setQueue] = useState<VocabularyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [knownState, setKnownState] = useState<Record<string, boolean>>({});
  const [deck, setDeck] = useState<VocabularyWord[]>(SEED_VOCABULARY);
  const [storeError, setStoreError] = useState<string | null>(null);
  const markingRef = useRef(false);

  const refreshDeck = useCallback(() => {
    getAllVocabulary()
      .then(setDeck)
      .catch((error: unknown) => setStoreError(errText(error, 'Could not load your saved cards.')));
  }, []);

  const reloadStores = useCallback(() => {
    getKnownState()
      .then((state) => {
        setKnownState(state);
        setStoreError(null);
      })
      .catch((error: unknown) => {
        setStoreError(errText(error, 'Could not load your saved words.'));
      });
    refreshDeck();
  }, [refreshDeck]);

  useEffect(() => {
    reloadStores();
  }, [reloadStores]);

  const trimmed = description.trim();

  const handleSubmit = useCallback(() => {
    if (!trimmed) {
      return;
    }
    setQueue(rankVocabulary(trimmed, knownState, deck));
    setIndex(0);
    setPhase('card');
  }, [trimmed, knownState, deck]);

  const handleAddCard = useCallback(
    async (input: AddUserWordInput) => {
      const result = await addUserWord(input);
      if (result.ok) {
        refreshDeck();
      }
      return result;
    },
    [refreshDeck],
  );

  const handleUpdateCard = useCallback(
    async (id: string, input: UpdateUserWordInput) => {
      const result = await updateUserWord(id, input);
      if (result.ok) {
        refreshDeck();
      }
      return result;
    },
    [refreshDeck],
  );

  const handleDeleteCard = useCallback(
    async (id: string) => {
      const result = await deleteUserWord(id);
      if (!result.ok) {
        setStoreError("You're offline — couldn't delete that card.");
      }
      refreshDeck();
      return result;
    },
    [refreshDeck],
  );

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
      } catch (error: unknown) {
        // The write failed — do NOT apply the optimistic update or advance the
        // card, or the UI would show a state that was never persisted.
        setStoreError(
          error instanceof Error ? error.message : 'Could not save that answer. Try again.',
        );
        return;
      } finally {
        markingRef.current = false;
      }
      setStoreError(null);
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
          {storeError && (
            <ThemedView type="backgroundElement" style={styles.errorBanner}>
              <ThemedText type="smallBold" accessibilityRole="alert">
                {storeError}
              </ThemedText>
              <Pressable
                onPress={reloadStores}
                accessibilityRole="button"
                accessibilityLabel="Try again">
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.textLink}>
                  Try again
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {phase === 'input' && (
          <ThemedView style={styles.inputBlock}>
            <ThemedText type="title" style={styles.heading} accessibilityRole="header">
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
              accessibilityLabel="Person description"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
            <Pressable
              onPress={handleSubmit}
              disabled={!trimmed}
              accessibilityRole="button"
              accessibilityLabel="Show me a word">
              <ThemedView
                type={trimmed ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.submitButton}>
                <ThemedText type="smallBold">Show me a word</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              onPress={() => setPhase('manage')}
              accessibilityRole="button"
              accessibilityLabel="Manage my cards">
              <ThemedText type="small" themeColor="textSecondary" style={styles.textLink}>
                Manage my cards
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                void signOut();
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign out">
              <ThemedText type="small" themeColor="textSecondary" style={styles.textLink}>
                Sign out
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {phase === 'manage' && (
          <ManageCards
            userWords={deck.filter((word) => word.id.startsWith('user-'))}
            onAdd={handleAddCard}
            onUpdate={handleUpdateCard}
            onDelete={handleDeleteCard}
            onClose={() => setPhase('input')}
          />
        )}

        {phase === 'card' && currentWord && (
          <ThemedView style={styles.cardBlock}>
            <Flashcard
              word={currentWord}
              known={knownState[currentWord.id]}
              onMark={handleMark}
            />
            <Pressable
              onPress={startNewDescription}
              accessibilityRole="button"
              accessibilityLabel="New description">
              <ThemedText type="small" themeColor="textSecondary" style={styles.textLink}>
                New description
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {phase === 'done' && (
          <ThemedView style={styles.inputBlock}>
            <ThemedText type="title" style={styles.heading} accessibilityRole="header">
              That’s every word for this description.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Start a new one to practise for a different conversation.
            </ThemedText>
            <Pressable
              onPress={startNewDescription}
              accessibilityRole="button"
              accessibilityLabel="New description">
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
  errorBanner: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
  },
});
