import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { VocabularyWord } from '@/constants/vocabulary';

export type FlashcardProps = {
  word: VocabularyWord;
  known: boolean | undefined;
  onMark: (known: boolean) => void;
};

/**
 * Presentational card: shows one word with its category and definition, plus the
 * two mark actions. No data access, no ranking, no navigation.
 */
export function Flashcard({ word, known, onMark }: FlashcardProps) {
  return (
    <ThemedView style={styles.card}>
      <ThemedView type="backgroundElement" style={styles.face}>
        <ThemedText type="small" themeColor="textSecondary">
          {word.category}
        </ThemedText>
        <ThemedText type="subtitle" style={styles.word}>
          {word.word}
        </ThemedText>
        <ThemedText style={styles.definition}>{word.definition}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.actions}>
        <Pressable style={styles.actionPressable} onPress={() => onMark(true)}>
          <ThemedView
            type={known === true ? 'backgroundSelected' : 'backgroundElement'}
            style={styles.actionButton}>
            <ThemedText type="smallBold">Know it</ThemedText>
          </ThemedView>
        </Pressable>
        <Pressable style={styles.actionPressable} onPress={() => onMark(false)}>
          <ThemedView
            type={known === false ? 'backgroundSelected' : 'backgroundElement'}
            style={styles.actionButton}>
            <ThemedText type="smallBold">Don&apos;t know it</ThemedText>
          </ThemedView>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
  face: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  word: {
    fontSize: 32,
    lineHeight: 38,
  },
  definition: {
    marginTop: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionPressable: {
    flex: 1,
  },
  actionButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
