import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { VocabularyWord } from '@/constants/vocabulary';
import { getKnownState, getSeedVocabulary, setWordKnownState } from '@/lib/vocabulary-store';

const CARD_HEIGHT = 96;

export default function DebugVocabularyScreen() {
  const words = getSeedVocabulary();
  const [knownState, setKnownState] = useState<Record<string, boolean>>({});

  const loadKnownState = useCallback(() => {
    getKnownState().then(setKnownState);
  }, []);

  useEffect(() => {
    loadKnownState();
  }, [loadKnownState]);

  const handleSetKnown = useCallback(
    async (wordId: string, known: boolean) => {
      await setWordKnownState(wordId, known);
      loadKnownState();
    },
    [loadKnownState],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Vocabulary Debug
        </ThemedText>
        <ThemedText type="small">
          Tap a card to flip it. Use ✓ / ✗ on the right to mark known / unknown.
        </ThemedText>
        <FlatList
          data={words}
          keyExtractor={(word) => word.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <FlashcardRow
              word={item}
              state={item.id in knownState ? knownState[item.id] : undefined}
              onSetKnown={(known) => handleSetKnown(item.id, known)}
            />
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function FlashcardRow({
  word,
  state,
  onSetKnown,
}: {
  word: VocabularyWord;
  state: boolean | undefined;
  onSetKnown: (known: boolean) => void;
}) {
  const rotation = useSharedValue(0);

  const handleFlip = () => {
    rotation.value = withTiming(rotation.value === 0 ? 180 : 0, { duration: 300 });
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${rotation.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${rotation.value + 180}deg` }],
  }));

  return (
    <ThemedView style={styles.row}>
      <Pressable style={styles.cardTouchArea} onPress={handleFlip}>
        <ThemedView style={styles.cardStack}>
          <Animated.View style={[styles.cardFace, frontStyle]}>
            <ThemedView type="backgroundElement" style={styles.cardFaceInner}>
              <ThemedText type="smallBold">{word.word}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {word.category}
              </ThemedText>
            </ThemedView>
          </Animated.View>
          <Animated.View style={[styles.cardFace, backStyle]}>
            <ThemedView type="backgroundElement" style={styles.cardFaceInner}>
              <ThemedText type="small">{word.definition}</ThemedText>
            </ThemedView>
          </Animated.View>
        </ThemedView>
      </Pressable>
      <ThemedView style={styles.knownControls}>
        <Pressable onPress={() => onSetKnown(true)}>
          <ThemedView
            type={state === true ? 'backgroundSelected' : 'backgroundElement'}
            style={styles.knownButton}>
            <ThemedText type="smallBold">✓</ThemedText>
          </ThemedView>
        </Pressable>
        <Pressable onPress={() => onSetKnown(false)}>
          <ThemedView
            type={state === false ? 'backgroundSelected' : 'backgroundElement'}
            style={styles.knownButton}>
            <ThemedText type="smallBold">✗</ThemedText>
          </ThemedView>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
  },
  listContent: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cardTouchArea: {
    flex: 1,
    height: CARD_HEIGHT,
  },
  cardStack: {
    flex: 1,
    height: CARD_HEIGHT,
  },
  cardFace: {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
  },
  cardFaceInner: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    gap: Spacing.half,
  },
  knownControls: {
    height: CARD_HEIGHT,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  knownButton: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
