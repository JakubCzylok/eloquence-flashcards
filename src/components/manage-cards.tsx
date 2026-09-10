import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { VocabularyCategory, VocabularyWord } from '@/constants/vocabulary';
import { AddUserWordInput, UpdateUserWordInput } from '@/lib/user-vocabulary';
import { CATEGORY_ORDER } from '@/lib/vocabulary-ranking';

type SubmitResult = { ok: boolean; reason?: string };

export type ManageCardsProps = {
  userWords: VocabularyWord[];
  onAdd: (input: AddUserWordInput) => Promise<SubmitResult>;
  onUpdate: (id: string, input: UpdateUserWordInput) => Promise<SubmitResult>;
  onDelete: (id: string) => Promise<SubmitResult>;
  onClose: () => void;
};

const REASON_MESSAGE: Record<string, string> = {
  duplicate: 'That word is already in your deck.',
  empty: 'Fill in both the word and its definition.',
  'not-found': 'That card no longer exists.',
  offline: 'You’re offline — try again when you have a connection.',
};

/**
 * The "My cards" view: a list of the user's own vocabulary cards (edit / delete
 * each) and a form to add a new one or edit the selected one. Presentational —
 * all persistence and the deck refresh live in the screen via the callbacks.
 */
export function ManageCards({ userWords, onAdd, onUpdate, onDelete, onClose }: ManageCardsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [word, setWord] = useState('');
  const [definition, setDefinition] = useState('');
  const [category, setCategory] = useState<VocabularyCategory>(CATEGORY_ORDER[0]);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setWord('');
    setDefinition('');
    setCategory(CATEGORY_ORDER[0]);
    setError(null);
  };

  const startEdit = (card: VocabularyWord) => {
    setEditingId(card.id);
    setWord(card.word);
    setDefinition(card.definition);
    setCategory(card.category);
    setError(null);
    setConfirmingDeleteId(null);
  };

  const submit = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = editingId
        ? await onUpdate(editingId, { definition, category })
        : await onAdd({ word, definition, category });
      if (result.ok) {
        resetForm();
      } else {
        setError(
          REASON_MESSAGE[result.reason ?? ''] ??
            'That didn’t work — check the fields and try again.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePress = async (id: string) => {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      return;
    }
    setConfirmingDeleteId(null);
    if (editingId === id) {
      resetForm();
    }
    const result = await onDelete(id);
    if (!result.ok) {
      setError(REASON_MESSAGE[result.reason ?? ''] ?? 'Could not delete that card.');
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Back to input"
        style={styles.link}>
        <ThemedText type="small" themeColor="textSecondary">
          ‹ Back
        </ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.heading} accessibilityRole="header">
        My cards
      </ThemedText>

      {userWords.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No cards yet. Add one below and it’ll rank alongside the built-in words.
        </ThemedText>
      ) : (
        userWords.map((card) => (
          <ThemedView key={card.id} type="backgroundElement" style={styles.row}>
            <ThemedText type="smallBold">{card.word}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {card.category}
            </ThemedText>
            <ThemedText type="small">{card.definition}</ThemedText>
            <View style={styles.rowActions}>
              <Pressable
                onPress={() => startEdit(card)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${card.word}`}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Edit
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => handleDeletePress(card.id)}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${card.word}`}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {confirmingDeleteId === card.id ? 'Tap again to delete' : 'Delete'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        ))
      )}

      <ThemedText type="smallBold" style={styles.formHeading} accessibilityRole="header">
        {editingId ? 'Edit card' : 'Add a card'}
      </ThemedText>

      <ThemedTextInput
        value={word}
        onChangeText={setWord}
        placeholder="Word"
        accessibilityLabel="Word"
        editable={editingId === null}
      />
      <ThemedTextInput
        value={definition}
        onChangeText={setDefinition}
        placeholder="Definition"
        accessibilityLabel="Definition"
        multiline
      />

      <View style={styles.chips}>
        {CATEGORY_ORDER.map((option) => (
          <Pressable
            key={option}
            onPress={() => setCategory(option)}
            accessibilityRole="button"
            accessibilityLabel={`Category ${option}`}
            accessibilityState={{ selected: category === option }}>
            <ThemedView
              type={category === option ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.chip}>
              <ThemedText type="small">{option}</ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </View>

      {error && (
        <ThemedText type="small" accessibilityRole="alert">
          {error}
        </ThemedText>
      )}

      <Pressable
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={editingId ? 'Save card' : 'Add card'}>
        <ThemedView type="backgroundSelected" style={styles.submit}>
          <ThemedText type="smallBold">{editingId ? 'Save card' : 'Add card'}</ThemedText>
        </ThemedView>
      </Pressable>

      {editingId && (
        <Pressable
          onPress={resetForm}
          accessibilityRole="button"
          accessibilityLabel="Cancel edit"
          style={styles.link}>
          <ThemedText type="small" themeColor="textSecondary">
            Cancel
          </ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  content: {
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  link: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingRight: Spacing.four,
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
  },
  row: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  formHeading: {
    marginTop: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  submit: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
