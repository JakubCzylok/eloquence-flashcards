# Repository Guidelines

Eloquence Flashcards is an Expo (React Native + TypeScript) mobile app: the user types a short description of who they're about to talk to, the app shows a tailored vocabulary flashcard, and they mark it known/unknown. Single-user, on-device only — no backend, no auth, no network calls beyond Expo tooling itself.

## Hard rules

- Expo is pinned to `~57.0.14` (`@package.json`) — a fast-moving API surface where training-data knowledge is frequently stale. Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any Expo-facing code.
- Do not build or train a custom NLP/matching model for word selection — the PRD's Non-Goals require a simple, rule-based/off-the-shelf matching approach instead (see `@context/foundation/prd.md`).
- No auth, login flow, or multi-profile support — the product is explicitly single-user with on-device-only data.

## Project Structure & Module Organization

- `src/app/` — expo-router file-based routes. `_layout.tsx` is the root layout; `index.tsx` and `explore.tsx` are screens.
- `src/components/` — kebab-case filenames (e.g. `themed-text.tsx`), PascalCase named exports (not default). Platform-specific variants use a `.web.tsx` suffix — compare `@src/components/animated-icon.tsx` and `@src/components/animated-icon.web.tsx`.
- `src/constants/theme.ts` — theme tokens (`Fonts`, `ThemeColor`, `Spacing`). `src/hooks/` — custom hooks.
- Import across directories via the `@/*` alias (`@/components/...`, `@/hooks/...`), not relative paths — see `@tsconfig.json`.
- `assets/` — icons and images. `scripts/reset-project.js` moves the starter template into `app-example/` and blanks `src/app/` — destructive, don't run casually.

## Build, Test, and Development Commands

- `npm run start` — Expo dev server; choose a platform from there.
- `npm run android` / `npm run ios` / `npm run web` — start directly on one platform.
- `npm run lint` — runs `expo lint`; no ESLint config exists yet, first run scaffolds one.
- `npm run reset-project` — see the destructive note above.

## Coding Style & Naming Conventions

- TypeScript strict mode (`@tsconfig.json`). Single quotes, semicolons, `StyleSheet.create()` placed at the bottom of the file after the component.
- Route files under `src/app/` use `export default`; everything else uses named exports.

## Testing Guidelines

No test runner is configured yet — no `*.test.*` files or Jest/Vitest config exist. Follow Expo's unit-testing guide (linked from `@README.md.scaffold`) before introducing one.
