# E2E Testing Rules

Read this before generating or reviewing any test in `e2e/`. `seed.spec.ts` is
the worked example — every generated test is modelled on it. What the seed shows
is what the agent produces.

## Status: spike

`context/foundation/test-plan.md` §7 deliberately excludes E2E from the rollout
("the app is small, single-user, and on-device; full E2E setup cost dwarfs the
signal now"). This directory exists to exercise the Module 3 Lesson 4 workflow
against the one risk with genuine browser-shaped signal — **R5** (the loop shows
a blank card or freezes with no way back to the input screen). It is not a
required quality gate and is not wired into CI. If E2E earns a permanent place,
add a row to §3 and revise §7 first.

## The rules block (Playwright)

- Use `getByRole`, `getByLabel`, `getByText` as primary locators. Fall back to
  `getByTestId` only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- Each test must be independently runnable — no shared state between tests.
- Never use `page.waitForTimeout()`. Wait for specific conditions:
  `toBeVisible()`, `waitForURL()`, `waitForResponse()`.
- Assert the business outcome, not implementation details.
- Use unique identifiers (e.g. a `Date.now()` suffix) for test data to avoid
  collisions in parallel runs. Clean up in `afterEach`.
- Name the test after the risk it protects
  (`test('loop reaches its end state and returns to input …')`), not `test('test 1')`.
- Control question for every assertion: **would this fail if the `test-plan.md`
  risk materialised?** If not, it is decorative — delete it.

## This project's specifics

- **Target is Expo web, served from a static export.** `npm run e2e` runs
  `expo export --platform web` then serves `dist/` on `http://localhost:8081`
  via `playwright.config.ts`'s `webServer` block (~90s cold export first). The
  Metro **dev server** (`expo start --web`) is deliberately not used: on this
  WSL / `/mnt/c` mount it serves stale bundles even after `--clear`, which
  silently breaks the deliberate-break check (a real regression left the test
  green because the browser ran cached code). `expo export` rebuilds from
  scratch every run.
- **Deliberate-break check needs a fresh export.** `reuseExistingServer` is true
  locally, so an already-running server is reused *without* re-exporting. When
  confirming a test goes red on a real regression: `fuser -k 8081/tcp`, then
  re-run so the export rebuilds — otherwise you are testing yesterday's `dist/`.
- **The app is behind a login gate (change `auth`).** `npm run e2e` needs `.env`
  (`EXPO_PUBLIC_SUPABASE_*`, inlined into the export) and a Supabase project
  with sign-ups + email autoconfirm on. The `setup` project (`e2e/auth.setup.ts`)
  signs up a throwaway user per run and saves the session to
  `playwright/.auth/user.json`; the `chromium` project loads it via
  `storageState`, so `seed` / `loop-gibberish` / `custom-flashcards-crud` start
  inside the app with no per-spec login code. `e2e/auth-per-user-data.spec.ts`
  runs in the `chromium-auth-flow` project with NO stored session — it drives
  its own sign-ups to test the gate (R8) and cross-user isolation (R9).
- Test emails must use a real domain (`@gmail.com`) — Supabase rejects reserved
  TLDs like `.test`.
- **No auth. No `storageState`.** The app is single-user and on-device; there is
  no login. The lesson's storageState / `playwright/.auth/user.json` section
  does not apply. "Session" state is the AsyncStorage known/unknown map, which
  React Native Web backs with `window.localStorage`.
- **Test data = the typed description + the known/unknown marks.** The
  description is in-memory only and never persisted (that is R7), so the only
  thing to clean between runs is `localStorage`. `seed.spec.ts` clears it in
  `afterEach`.
- **React Native Web role mapping.** `Pressable` renders a plain `<div>` unless
  it carries `accessibilityRole` — components acting as buttons were given
  `accessibilityRole="button"` + `accessibilityLabel` so `getByRole('button',
  { name })` resolves. `TextInput` renders `<input>` (implicit role `textbox`);
  it was given `accessibilityLabel="Person description"` so `getByLabel` works.
  If a new interactive element is not reachable by role, add the a11y prop to
  the component rather than reaching for a CSS selector in the test.

## Five anti-patterns to review every generated test against

1. **Hallucinated assertion** — syntactically valid, semantically empty (asserts
   a page title instead of the outcome the risk is about).
2. **Brittle selector** — `page.locator('div > div:nth-child(3) > button')`
   instead of `getByRole`.
3. **Shared state between tests** — test B assumes test A ran first; flakes under
   parallel/random order.
4. **`waitForTimeout` instead of waiting for state** — passes locally, flakes in
   CI.
5. **No cleanup** — creates data, never tears it down; second run collides.

## Re-prompt discipline

Never say "fix this test." Name the anti-pattern, explain why it does not protect
R5 (or why it produces false failures), and give the target pattern. Three
elements: *what's wrong*, *why it doesn't protect the risk*, *what replaces it*.
