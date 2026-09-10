import { expect, test } from '@playwright/test';

/**
 * Risk: context/foundation/test-plan.md §2 Risk #5 — "The loop shows a blank
 * card or freezes with no way back to the input screen — e.g. after the last
 * card, on a description that matches nothing, or on a screen a later feature
 * added."
 *
 * This is the "matches nothing" variant of seed.spec.ts. The description
 * contains no tokens that hit any category keyword, so rankVocabulary takes its
 * fallback branch (return the whole deck in seed order). The loop must still
 * render a card and reach its terminal state: an empty fallback queue would
 * leave phase === 'card' with no currentWord — a blank screen with no way out.
 *
 * Modeled on seed.spec.ts — same role-based locators, same wait-for-state
 * discipline, same cleanup. See e2e/e2e-rules.md.
 */

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.localStorage.clear());
});

test('a description that matches nothing still reaches a card and completes the loop', async ({
  page,
}) => {
  test.slow(); // 72 marks, each a Supabase round-trip

  // Pure gibberish — no token matches any category keyword. Date.now() keeps
  // the input unique across parallel runs and re-runs.
  const description = `zxqwpt ${Date.now()} bfjkmn vqhldz`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /who are you about to talk to/i })).toBeVisible();

  // --- Action: submit a no-match description ---
  const input = page.getByLabel('Person description');
  await input.click();
  await input.pressSequentially(description);

  const submit = page.getByRole('button', { name: 'Show me a word' });
  await expect(submit).toBeEnabled(); // wait for state: the description reached React
  await submit.click();

  // R5, part 1: the no-match description still reaches a card with a non-empty
  // rendered word — not a blank screen from an empty fallback queue.
  const cardWord = page.getByRole('heading');
  await expect(cardWord).toBeVisible();
  expect((await cardWord.textContent())?.trim()).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Know it', exact: true })).toBeVisible();

  // --- Action: mark through the whole fallback queue ---
  // Length is data-driven (the full deck on the fallback path). Marking is
  // async (Supabase upsert, then advance), so wait for the shown word to change
  // before the next click.
  const knowIt = page.getByRole('button', { name: 'Know it', exact: true });
  const endHeading = page.getByRole('heading', { name: /every word for this description/i });
  for (let i = 0; i < 200 && !(await endHeading.isVisible()); i++) {
    const shown = (await cardWord.textContent())?.trim() ?? '';
    await knowIt.click();
    await expect
      .poll(async () => (await endHeading.isVisible()) || (await cardWord.textContent())?.trim() !== shown)
      .toBe(true);
  }

  // R5, part 2: the fallback loop reaches its terminal state (no freeze).
  await expect(endHeading).toBeVisible();

  // R5, part 3: the terminal state routes back to the input screen.
  await page.getByRole('button', { name: 'New description' }).click();
  await expect(page.getByRole('heading', { name: /who are you about to talk to/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show me a word' })).toBeVisible();
});
