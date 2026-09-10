import { expect, test as setup } from '@playwright/test';

// Sign up a throwaway user once per `npm run e2e` and save its session, so the
// gated specs (seed / loop-gibberish / custom-flashcards-crud) can start inside
// the app. A fresh email each run keeps the account's data clean; the account
// itself is disposable test cruft in the Supabase project.
const SESSION_FILE = 'playwright/.auth/user.json';

setup('create a signed-in session', async ({ page }) => {
  const email = `eloquence.e2e.${Date.now()}@gmail.com`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to create account' }).click();
  await page.getByLabel('Email').pressSequentially(email);
  await page.getByLabel('Password').pressSequentially('e2e-shared-pass-123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: /who are you about to talk to/i })).toBeVisible({
    timeout: 20_000,
  });

  await page.context().storageState({ path: SESSION_FILE });
});
