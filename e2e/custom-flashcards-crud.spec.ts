import { expect, test } from '@playwright/test';

/**
 * S-03 custom-flashcards — the full CRUD lifecycle of a user-authored card,
 * end to end through the manage view and the ranking loop.
 *
 * Covers plan.md Phase 2 manual steps 2.4–2.9 as an automated check, and is the
 * evidence that FR-004 gives user cards a real Create / Read / Update / Delete
 * (the MVP "CRUD actions" criterion). Not in the original plan's test scope
 * (which said "manual-verified"); added because this flow is the gap it closes.
 *
 * Modeled on seed.spec.ts — role-based locators, wait-for-state, unique data,
 * localStorage cleanup.
 */

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.localStorage.clear());
});

test('a user card can be created, ranked, edited, and deleted', async ({ page }) => {
  const word = `gravitas ${Date.now()}`;
  const definition = 'a serious, dignified manner';
  const editedDefinition = 'weighty seriousness that commands respect';

  await page.goto('/');

  // --- CREATE: open the manage view and add a card ---
  await page.getByRole('button', { name: 'Manage my cards' }).click();
  await expect(page.getByRole('heading', { name: 'My cards' })).toBeVisible();
  await expect(page.getByText(/no cards yet/i)).toBeVisible();

  await page.getByLabel('Word').pressSequentially(word);
  await page.getByLabel('Definition').pressSequentially(definition);
  await page.getByRole('button', { name: 'Category academic' }).click();
  await page.getByRole('button', { name: 'Add card' }).click();

  // it now shows in the list
  await expect(page.getByText(word)).toBeVisible();
  await expect(page.getByText(definition)).toBeVisible();

  // duplicate is rejected, not added
  await page.getByLabel('Word').pressSequentially(word);
  await page.getByLabel('Definition').pressSequentially('another take');
  await page.getByRole('button', { name: 'Add card' }).click();
  await expect(page.getByRole('alert')).toHaveText(/already in your deck/i);

  // --- READ / rank: the card is reachable in a category-matching loop ---
  await page.getByRole('button', { name: 'Back to input' }).click();
  await page.getByLabel('Person description').pressSequentially('a philosophy professor');
  const submit = page.getByRole('button', { name: 'Show me a word' });
  await expect(submit).toBeEnabled();
  await submit.click();

  const cardHeading = page.getByRole('heading');
  const endHeading = page.getByRole('heading', { name: /every word for this description/i });
  const knowIt = page.getByRole('button', { name: 'Know it', exact: true });
  let sawUserCard = false;
  for (let i = 0; i < 200; i++) {
    if (await endHeading.isVisible()) {
      break;
    }
    if ((await cardHeading.textContent())?.trim() === word) {
      sawUserCard = true;
      break;
    }
    await knowIt.click();
  }
  expect(sawUserCard).toBe(true);

  // --- UPDATE: edit the card's definition ---
  await page.getByRole('button', { name: 'New description' }).click();
  await page.getByRole('button', { name: 'Manage my cards' }).click();
  await page.getByRole('button', { name: `Edit ${word}` }).click();
  const definitionField = page.getByLabel('Definition');
  // Clear via the keyboard — RN Web's TextInput only updates React state from
  // real key events, so locator.fill('') would not empty the controlled value.
  await definitionField.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await definitionField.pressSequentially(editedDefinition);
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.getByText(editedDefinition)).toBeVisible();
  await expect(page.getByText(definition)).toHaveCount(0);

  // --- DELETE: remove the card (two-tap confirm) ---
  const deleteButton = page.getByRole('button', { name: `Delete ${word}` });
  await deleteButton.click();
  await expect(deleteButton).toHaveText(/tap again to delete/i);
  await deleteButton.click();
  await expect(page.getByText(word)).toHaveCount(0);
  await expect(page.getByText(/no cards yet/i)).toBeVisible();
});
