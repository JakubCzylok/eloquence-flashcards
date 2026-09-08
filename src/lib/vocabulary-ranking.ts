import { CATEGORY_KEYWORDS } from '@/constants/category-keywords';
import { SEED_VOCABULARY, VocabularyCategory, VocabularyWord } from '@/constants/vocabulary';

/**
 * Canonical category ordering, used only for deterministic tie-breaking when two
 * categories score equally. Mirrors the `VocabularyCategory` union order.
 *
 * Exported so tests can assert it stays in sync with `CATEGORY_KEYWORDS` — TypeScript
 * does not enforce that this bare array covers the `VocabularyCategory` union.
 */
export const CATEGORY_ORDER: VocabularyCategory[] = [
  'business',
  'academic',
  'arts-culture',
  'science-tech',
  'current-events',
  'travel',
  'food-cuisine',
  'sports-fitness',
  'family-relationships',
];

/**
 * Small filler-word set removed before matching. Deliberately short — an
 * over-eager stopword list drops real signal.
 */
const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'who',
  'with',
  'that',
  'they',
  'she',
  'her',
  'him',
  'his',
  'about',
  'going',
  'talk',
  'talking',
  'meet',
  'meeting',
  'was',
  'are',
  'has',
  'had',
  'will',
  'would',
  'just',
  'get',
  'got',
  'from',
  'have',
  'been',
  'into',
  'very',
  'really',
  'someone',
  'person',
  'people',
  'guy',
  'friend',
  'this',
  'not',
]);

/** Lowercase the description and split it into a set of matchable, deduped tokens. */
function tokenize(description: string): Set<string> {
  return new Set(
    description
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
  );
}

/** Score every category by how many of its keywords appear in the token set; keep the non-zero ones. */
function matchedCategories(tokens: Set<string>): VocabularyCategory[] {
  const scored: { category: VocabularyCategory; score: number }[] = [];
  for (const category of CATEGORY_ORDER) {
    let score = 0;
    for (const keyword of CATEGORY_KEYWORDS[category]) {
      if (tokens.has(keyword)) {
        score += 1;
      }
    }
    if (score > 0) {
      scored.push({ category, score });
    }
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );
  return scored.map((entry) => entry.category);
}

/**
 * Emit words from several category buckets in round-robin order (one from each
 * category per lap, in the given category order), preserving each bucket's
 * internal order. Buckets that run out are skipped on later laps.
 */
function roundRobin(
  order: VocabularyCategory[],
  buckets: Map<VocabularyCategory, VocabularyWord[]>,
): VocabularyWord[] {
  const result: VocabularyWord[] = [];
  const cursors = new Map<VocabularyCategory, number>(order.map((category) => [category, 0]));
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const category of order) {
      const bucket = buckets.get(category) ?? [];
      const cursor = cursors.get(category) ?? 0;
      if (cursor < bucket.length) {
        result.push(bucket[cursor]);
        cursors.set(category, cursor + 1);
        progressed = true;
      }
    }
  }
  return result;
}

/**
 * Rank a vocabulary deck against a free-text description of the person /
 * interests the user is about to talk to.
 *
 * Pure and deterministic — no randomness, no clock, no external state. The result
 * is always a permutation of `deck`: every word appears exactly once, so the
 * caller can treat it as both the ranked result and the "no dead-ends" fallback
 * for input that matches nothing.
 *
 * `deck` defaults to `SEED_VOCABULARY`. The loop screen passes the merged deck
 * (seed + user-authored cards) from `getAllVocabulary()`; user cards bucket by
 * `category` exactly like seed words.
 *
 * Order:
 *   1. matched-category words the user has NOT marked known (round-robin across
 *      matched categories, most-relevant category first)
 *   2. matched-category words the user HAS marked known (same round-robin)
 *   3. remaining words the user has NOT marked known (deck order)
 *   4. remaining words the user HAS marked known (deck order)
 *
 * When no category matches, steps 1–2 are empty and the result is the whole deck
 * in not-known-then-known, deck order.
 */
export function rankVocabulary(
  description: string,
  knownState: Record<string, boolean>,
  deck: VocabularyWord[] = SEED_VOCABULARY,
): VocabularyWord[] {
  const seed = deck;
  const matched = matchedCategories(tokenize(description));
  const matchedSet = new Set(matched);
  const isKnown = (word: VocabularyWord) => knownState[word.id] === true;

  const matchedNotKnown = new Map<VocabularyCategory, VocabularyWord[]>(
    matched.map((category) => [category, []]),
  );
  const matchedKnown = new Map<VocabularyCategory, VocabularyWord[]>(
    matched.map((category) => [category, []]),
  );
  const unmatchedNotKnown: VocabularyWord[] = [];
  const unmatchedKnown: VocabularyWord[] = [];

  for (const word of seed) {
    if (matchedSet.has(word.category)) {
      const bucket = (isKnown(word) ? matchedKnown : matchedNotKnown).get(word.category);
      if (bucket) {
        bucket.push(word);
      }
    } else if (isKnown(word)) {
      unmatchedKnown.push(word);
    } else {
      unmatchedNotKnown.push(word);
    }
  }

  return [
    ...roundRobin(matched, matchedNotKnown),
    ...roundRobin(matched, matchedKnown),
    ...unmatchedNotKnown,
    ...unmatchedKnown,
  ];
}
