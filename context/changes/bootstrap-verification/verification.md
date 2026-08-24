---
bootstrapped_at: 2026-08-17T19:01:36Z
starter_id: expo
starter_name: Expo (React Native)
project_name: eloquence-flashcards
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: expo
package_manager: npm
project_name: eloquence-flashcards
hints:
  language_family: js
  team_size: solo
  deployment_target: appstore-via-eas
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: false
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

A solo builder shipping a local-first, single-user mobile flashcard MVP in 1.5 after-hours weeks needs the fastest path to a working iOS+Android app with no backend. Expo is the recommended default for `(mobile, js)`, clears all four agent-friendly gates, and its bootstrapper confidence is verified, so scaffolding will be smooth. No auth, payments, realtime, AI, or background jobs are in scope per the PRD's FRs and Non-Goals — the app runs entirely on-device. Deployment defaults to app-store distribution via EAS, the starter's standard target; CI runs on GitHub Actions with auto-deploy-on-merge.

## Pre-scaffold verification

| Signal      | Value                                          | Severity | Notes                                                       |
| ----------- | ----------------------------------------------- | -------- | ------------------------------------------------------------ |
| npm package | create-expo-app v4.0.0 published 2026-08-01     | fresh    | resolved from `cmd_template` (`npx create-expo-app ...`)     |
| GitHub repo | not run                                         | n/a      | card `docs_url` is `https://docs.expo.dev`, not a GitHub repo URL |

## Scaffold log

**Resolved invocation**: `npx create-expo-app .bootstrap-scaffold --yes --template default`
**Strategy**: subdir-then-move
**Exit code**: 0
**Files moved**: 14 top-level paths (`.claude/settings.json` merged into existing `.claude/`; `.gitignore`, `.vscode/`, `AGENTS.md`, `LICENSE`, `app.json`, `assets/`, `node_modules/`, `package-lock.json`, `package.json`, `scripts/`, `src/`, `tsconfig.json` moved silently)
**Conflicts (.scaffold siblings)**: `CLAUDE.md.scaffold`, `README.md.scaffold`
**.gitignore handling**: moved silently (cwd had no `.gitignore`)
**.bootstrap-scaffold cleanup**: deleted

**Deviation from the standard sequence**: `create-expo-app`'s chained `npm install` step failed with `EPERM`/`chmod` errors while creating bin-symlinks — a known WSL limitation when a project lives on a Windows-mounted drive (`/mnt/c/...`, DrvFs). The CLI itself caught the failure, printed a warning, and completed scaffolding anyway (exit code 0), leaving `node_modules/` incomplete. Before applying the conflict matrix, dependencies were reinstalled with `npm install --no-bin-links` inside `.bootstrap-scaffold/`, which succeeded cleanly (601 packages, exit 0). The fully-installed `node_modules/` was then moved up as part of the normal merge.

**Additional deviation**: `create-expo-app` auto-runs `git init` as part of its own scaffolding, producing a `.bootstrap-scaffold/.git/` directory. Per the "bootstrapper does not initialise git" guardrail, this `.git/` was deleted before the move-up rather than moved into cwd (cwd was not a git repository prior to this run and none was introduced).

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 14 HIGH, 8 MODERATE, 0 LOW
**Direct vs transitive**: 4/8 direct of total dependency count 610 (582 prod, 11 optional, 18 peer); direct-vs-transitive computed from each finding's `isDirect` flag — 4 direct HIGH, 1 direct MODERATE reported below, remainder transitive

#### CRITICAL findings

None.

#### HIGH findings

- `expo` (direct) — fix available via `expo@53.0.27` (semver-major)
- `react-native` (direct) — fix available via `react-native@0.72.17` (semver-major)
- `react-native-reanimated` (direct) — fix available via `react-native-reanimated@4.2.2` (semver-major)
- `react-native-worklets` (direct) — fix available via `react-native-worklets@0.7.4` (semver-major)
- `image-size` (transitive, via `expo`) — advisories: "ICNS parser allows denial of service through an infinite loop", "JXL and HEIF parsers allow denial of service through infinite loops"
- `@expo/cli`, `@expo/metro`, `@expo/metro-config`, `@react-native/community-cli-plugin`, `@react-native/metro-config`, `@react-native/virtualized-lists`, `metro`, `metro-config`, `metro-transform-worker` (all transitive) — fix bundled with the `expo`/`react-native` major bump above

#### MODERATE findings

- `expo-splash-screen` (direct) — fix available via `expo-splash-screen@55.0.24` (semver-major)
- `uuid` (transitive, via `expo`) — advisory: "Missing buffer bounds check in v3/v5/v6 when buf is provided"
- `@expo/config`, `@expo/config-plugins`, `@expo/inline-modules`, `@expo/local-build-cache-provider`, `@expo/prebuild-config`, `xcode` (all transitive) — fix bundled with the `expo` major bump above

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                     | Value               |
| ------------------------ | -------------------- |
| bootstrapper_confidence  | verified              |
| quality_override         | false                 |
| path_taken               | standard              |
| self_check_answers       | null                  |
| team_size                | solo                  |
| deployment_target        | appstore-via-eas      |
| ci_provider               | github-actions         |
| ci_default_flow          | auto-deploy-on-merge  |
| has_auth                 | false                 |
| has_payments             | false                 |
| has_realtime             | false                 |
| has_ai                   | false                 |
| has_background_jobs      | false                 |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review `CLAUDE.md.scaffold` and `README.md.scaffold` against your existing `CLAUDE.md` / `README.md` and decide which content to keep or merge.
- The scaffold CLI's chained install hit a WSL/DrvFs `EPERM` limitation on bin-symlinks; if you run `npm install` again from a Windows-mounted path, pass `--no-bin-links`, or better, move the project to a native Linux path (e.g. under `~/`) to avoid the issue entirely going forward.
- All 18 HIGH/MODERATE findings resolve via one semver-major bump (`expo@53.0.27` and its dependents); review breaking changes before running `npm audit fix --force` — the full breakdown is in this log.
