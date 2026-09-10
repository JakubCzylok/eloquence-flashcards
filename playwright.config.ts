import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Target: Expo web from a STATIC EXPORT (`expo export --platform
 * web`), not the Metro dev server — on this WSL / `/mnt/c` mount the dev server
 * serves stale bundles even after `--clear`, which silently defeats the
 * deliberate-break check. `expo export` is a clean from-scratch build every run
 * (~90s cold). `web.output` is `single` (SPA) so there is no Node prerender.
 *
 * The app is behind a login gate (change `auth`), so `npm run e2e` needs `.env`
 * with `EXPO_PUBLIC_SUPABASE_*` (baked into the export) and a Supabase project
 * with sign-ups + email autoconfirm enabled. The `setup` project signs up a
 * throwaway user once per run and saves its session to
 * `playwright/.auth/user.json`; the `chromium` project reuses it. The
 * `chromium-auth-flow` project runs the auth spec itself with NO stored
 * session.
 *
 * NOTE for the deliberate-break check: `reuseExistingServer` is true locally,
 * so a stale server is reused WITHOUT re-exporting. Kill it and re-run when
 * verifying a real regression turns a test red.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts$/ },
    {
      name: 'chromium',
      testIgnore: [/auth\.setup\.ts$/, /auth-per-user-data\.spec\.ts$/],
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-auth-flow',
      testMatch: /auth-per-user-data\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command:
      'npx expo export --platform web --output-dir dist && python3 -m http.server 8081 --directory dist',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
