import { expect, test } from '@playwright/test';

/**
 * Risks: test-plan.md §2 R8 (access is really gated behind a session) and R9
 * (a user only ever sees their own rows — RLS + user_id scoping hold).
 *
 * Runs with NO stored session (project `chromium-auth-flow`), so it starts at
 * the login screen and drives its own sign-ups against the live Supabase
 * project. Requires the project to allow sign-ups with email autoconfirm on.
 *
 * Modeled on e2e/seed.spec.ts — role locators, wait-for-state,
 * `pressSequentially` for the RN Web inputs, unique data.
 */

async function signUp(page: import('@playwright/test').Page, email: string) {
  await page.getByRole('button', { name: 'Switch to create account' }).click();
  await page.getByLabel('Email').fill('');
  await page.getByLabel('Email').pressSequentially(email);
  await page.getByLabel('Password').fill('');
  await page.getByLabel('Password').pressSequentially('per-user-pass-123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: /who are you about to talk to/i })).toBeVisible({
    timeout: 20_000,
  });
}

test('data is gated by a session and isolated between accounts', async ({ page }) => {
  const a = `eloquence.iso.a.${Date.now()}@gmail.com`;
  const b = `eloquence.iso.b.${Date.now()}@gmail.com`;
  const word = `bespoke ${Date.now()}`;

  // R8 — no session: the app shows the login screen, never the loop
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /who are you about to talk to/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Manage my cards' })).toHaveCount(0);

  // account A adds a card
  await signUp(page, a);
  await page.getByRole('button', { name: 'Manage my cards' }).click();
  await page.getByLabel('Word').pressSequentially(word);
  await page.getByLabel('Definition').pressSequentially('made to individual order');
  await page.getByRole('button', { name: 'Category business' }).click();
  await page.getByRole('button', { name: 'Add card' }).click();
  await expect(page.getByText(word)).toBeVisible();

  // it survives a full reload — it came back from Supabase, not local state
  await page.reload();
  await expect(page.getByRole('heading', { name: /who are you about to talk to/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Manage my cards' }).click();
  await expect(page.getByText(word)).toBeVisible();

  // R9 — sign out, sign in as account B: none of A's data is visible
  await page.getByRole('button', { name: 'Back to input' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

  await signUp(page, b);
  await page.getByRole('button', { name: 'Manage my cards' }).click();
  await expect(page.getByText(/no cards yet/i)).toBeVisible();
  await expect(page.getByText(word)).toHaveCount(0);
});
