import { expect, test } from '@playwright/test';

/**
 * SEED TEST — the exemplar every generated E2E test in this directory is
 * modelled on. See `e2e/e2e-rules.md`.
 *
 * Risk: context/foundation/test-plan.md §2 Risk #5 — "The loop shows a blank
 * card or freezes with no way back to the input screen — e.g. after the last
 * card, on a description that matches nothing, or on a screen a later feature
 * added."
 *
 * What proves protection (§2 Risk Response Guidance, #5): a non-empty
 * description reaches a card with a rendered word; marking through the whole
 * queue reaches the terminal state; the terminal state has a working route back
 * to the input screen.
 *
 * Patterns this seed demonstrates:
 *   - role-based locators only (getByRole / getByLabel) — never CSS
 *   - wait for state (toBeVisible), never for time
 *   - a full self-contained cycle: setup, action, assertion, cleanup
 *   - test data carries a Date.now() suffix so parallel runs / re-runs cannot
 *     collide, and localStorage is reset in afterEach
 */

test.afterEach(async ({ page }) => {
  // The only persisted state is the AsyncStorage known/unknown map, which
  // React Native Web backs with window.localStorage. The typed description is
  // in-memory only (Risk #7) so there is nothing else to tear down.
  await page.evaluate(() => window.localStorage.clear());
});

test('loop reaches its end state and returns to input without dead-ending', async ({ page }) => {
  // Marking is now a Supabase round-trip per card, so a 72-card traversal is
  // dozens of network calls — well past the default 30s.
  test.slow();

  // Unique so a generated test that persists data (and re-runs of it) cannot
  // collide. Keywords ("history", "bikes") make the ranker produce a real
  // ordered queue rather than the fallback deck.
  const description = `E2E seed ${Date.now()} — a retired history teacher who races bikes`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /who are you about to talk to/i })).toBeVisible();

  // --- Action: submit a description and enter the loop ---
  // pressSequentially (not fill) — React Native Web's TextInput only fires
  // onChangeText from real key events, so fill() would leave React state empty
  // and the submit button disabled.
  const input = page.getByLabel('Person description');
  await input.click();
  await input.pressSequentially(description);

  const submit = page.getByRole('button', { name: 'Show me a word' });
  await expect(submit).toBeEnabled(); // wait for state: the description reached React
  await submit.click();

  // R5, part 1: the description reaches a card with a non-empty rendered word.
  const cardWord = page.getByRole('heading');
  await expect(cardWord).toBeVisible();
  expect((await cardWord.textContent())?.trim()).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Know it', exact: true })).toBeVisible();

  // --- Action: mark through the entire queue ---
  // Queue length is data-driven (72 seed words today), so loop until the
  // terminal state appears. Marking is async (Supabase upsert, then the card
  // advances), so wait for the shown word to change before the next click —
  // clicking faster than the mark resolves would be swallowed by the handler's
  // re-entrancy guard and stall the loop.
  const knowIt = page.getByRole('button', { name: 'Know it', exact: true });
  const endHeading = page.getByRole('heading', { name: /every word for this description/i });
  for (let i = 0; i < 200 && !(await endHeading.isVisible()); i++) {
    const shown = (await cardWord.textContent())?.trim() ?? '';
    await knowIt.click();
    await expect
      .poll(async () => (await endHeading.isVisible()) || (await cardWord.textContent())?.trim() !== shown)
      .toBe(true);
  }

  // R5, part 2: the loop reaches its terminal state (no freeze, no blank card).
  await expect(endHeading).toBeVisible();

  // R5, part 3: the terminal state has a working route back to the input screen.
  await page.getByRole('button', { name: 'New description' }).click();
  await expect(page.getByRole('heading', { name: /who are you about to talk to/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show me a word' })).toBeVisible();
});
