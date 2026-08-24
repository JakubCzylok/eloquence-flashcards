---
project: "Eloquence Flashcards"
researched_at: 2026-08-18
recommended_platform: EAS (Expo Application Services)
runner_up: Codemagic
context_type: mvp
tech_stack:
  language: TypeScript (JS family)
  framework: Expo (React Native, managed workflow)
  runtime: Expo SDK ~57 / React Native 0.86
---

## Recommendation

**Distribute via EAS (Expo Application Services) — Build, Submit, and Update.**

This is a backend-less, on-device-only mobile app, so the usual web-hosting candidate pool (Cloudflare, Vercel, Netlify, Fly.io, Railway, Render) doesn't apply — there is no server to deploy. The real decision is build/distribution tooling for the Expo-managed app already scaffolded by `/10x-bootstrapper`. EAS is purpose-built for exactly this stack, passes all five agent-friendly criteria, and matches two interview signals directly: no strong native-tooling familiarity (EAS's opaque, managed credential handling avoids the Fastlane/cert-lifecycle learning curve) and a preference for co-located push/OTA services under one vendor. `tech-stack.md` already recorded `deployment_target: appstore-via-eas` — this research confirms that pick rather than overturning it.

## Platform Comparison

| Platform | CLI-first | Managed/serverless | Agent-readable docs | Stable deploy API | MCP/integration |
|---|---|---|---|---|---|
| EAS | Pass | Pass | Pass | Pass | Pass *(free tier: fair-use limited)* |
| Codemagic | Partial | Partial | Pass | Partial *(Builds API is "preview")* | Fail *(community-only wrappers)* |
| Bitrise | Pass | Partial *(orchestrates EAS Build for Expo-managed apps, not an independent builder)* | Partial | Pass | Pass *(GA status unlabeled)* |
| GitHub Actions + Fastlane | Pass | Fail *(you own signing/cert lifecycle and must run `expo prebuild`)* | Pass | Partial | Partial |
| App Center | — | — | — | — | — *(excluded: Build/Distribute retired March 31, 2025)* |

**EAS** — `eas-cli` is fully scriptable (`--non-interactive`, `--json`, `--wait`), designed for CI use. It manages credentials, signing, and the full build/submit/update lifecycle without exposing raw provisioning-profile mechanics. Docs ship as `docs.expo.dev/llms.txt` / `llms-full.txt`, auto-generated on deploy. The Expo MCP Server is GA on the free plan (fair-use limited; unrestricted on paid), giving an agent live access to docs, build/update history, and TestFlight metadata.

**Codemagic** — Has no dedicated Expo-managed workflow; it runs `expo prebuild` on the CI machine each build and compiles natively, which works but isn't a first-class integration. Its Builds API is explicitly marked "preview" (may change without notice), and its bundled OTA service (CodePush) does not yet support Expo managed workflow. Docs are markdown-sourced on GitHub, which is a genuine strength. No first-party MCP server exists — only unverified community wrappers around the preview API.

**Bitrise** — For Expo-managed apps specifically, Bitrise's own default workflow calls the "Run EAS Build" step — it orchestrates EAS Build rather than building natively. That makes it a redundant layer for this stack: you'd inherit EAS's own build queue and limits, plus Bitrise's orchestration overhead and its steeper macOS-minute pricing (a 10x credit multiplier vs. Linux minutes on the free Hobby tier). A confirmed Bitrise MCP server and solid REST API are real strengths, but they don't offset the redundancy for a pure-managed, no-backend app.

**GitHub Actions + Fastlane** — The "raw infrastructure" option: requires `expo prebuild` (native `ios/`/`android/` dirs regenerated per build — reversible via Continuous Native Generation, not a permanent eject, but still a real step outside pure-managed workflow) and Fastlane `match` for certificate/profile lifecycle management. Fully scriptable end-to-end (`gh workflow_dispatch`, non-interactive App Store Connect API-key auth), and both GitHub Actions and Fastlane docs are markdown-native. GitHub ships an official, stable MCP server for the Actions layer, but nothing mobile-build-specific (signing, build status) is exposed through it. Best fit if EAS's vendor dependency or pricing ever becomes disqualifying — not before.

### Shortlisted Platforms

#### 1. EAS (Expo Application Services) (Recommended)

Purpose-built for this exact managed-Expo/React Native stack. Passes all five criteria, natively bundles push notifications and OTA updates (the co-location preference from the interview), and requires no additional credential-management tooling — `eas build` handles signing end-to-end. Already the deployment target recorded in `tech-stack.md`.

#### 2. Codemagic

The strongest genuinely-independent alternative — it builds natively rather than wrapping EAS, so it's a real fallback if EAS's queue times or the $225/mo Production tier ever become a blocker. The gap versus EAS: no first-class Expo-managed workflow (relies on per-build `prebuild`), a preview-status Builds API, and no bundled OTA support for managed-workflow apps yet.

#### 3. GitHub Actions + Fastlane

The full-control DIY option — zero recurring platform fees beyond GitHub Actions minutes, and no dependency on any single build-service vendor. The gap versus EAS: fails the "managed" criterion outright (you own cert/profile lifecycle via Fastlane `match`, and must exit pure-managed workflow via `prebuild`), which is a real cost given the interview's "no strong familiarity" answer on native tooling.

## Anti-Bias Cross-Check: EAS

### Devil's Advocate — Weaknesses

1. Free-tier build queue can exceed 90 minutes at peak — directly eats into a 1.5-week after-hours timeline; a failed build late at night could stall a whole session.
2. Crash reporting is not actually bundled despite the co-location preference — Sentry is still a separate account, just surfaced inside the EAS dashboard.
3. Cost cliff: exceeding the free tier's 15+15 builds/month means jumping to a $225/mo Production-tier minimum — a real commitment for a side project with a hard 1.5-week budget.
4. Vendor dependency on Expo Inc. for Build/Submit/Update; `eas build --local` exists as an escape hatch but isn't the default path and won't be battle-tested until it's actually needed under deadline pressure.
5. The Expo MCP Server is GA but "fair use limited" on the free plan — an agent polling build status frequently during active iteration could hit limits exactly when iterating fastest.

### Pre-Mortem — How This Could Fail

The solo builder wired EAS Build into a GitHub Actions auto-deploy-on-merge flow, assuming 15 free builds/month would comfortably cover a 1.5-week build-test-iterate loop. It didn't: three failed native-config attempts (a misconfigured icon asset, a splash-screen plugin ordering bug, a stale `app.json` slug still reading `.bootstrap-scaffold`) burned through the monthly allowance by day four, each retry queued 60-90 minutes behind other free-tier users. With the deadline eight days out and the free allowance exhausted, the builder faced an unplanned $225/mo charge never budgeted for a side project. The auto-deploy-on-merge flow kept queuing broken builds on every small commit, compounding the wait. By the time builds were flowing again, three of the remaining eight days were gone, and the MVP shipped two days late with a rushed, undertested TestFlight build — the PRD's "fast, snappy" guardrail was never actually verified on-device because there was no time left to test it.

### Unknown Unknowns

- The free-tier build queue is shared globally across all free-tier users — "90+ min at peak" isn't scheduled, it could land exactly during a planned after-hours session.
- EAS Update (OTA) can't change the RN version already embedded on a user's device — an SDK upgrade still needs a full store resubmission, so OTA doesn't fully insulate you from review timelines.
- The free tier only gets "medium" build workers with no pay-per-build option for a single faster one-off — the only way to speed up one urgent build is the full Production subscription.
- `app.json`'s `slug` (and `package.json`'s `name`) still read `.bootstrap-scaffold`/`bootstrap-scaffold` — a scaffolding leftover already flagged in `AGENTS.md`. The first `eas init` binds that placeholder slug to your Expo project ID; fix it before the first `eas build`, not after, or renaming later requires more than a text edit.
- `expo prebuild`'s Continuous Native Generation model is reversible for anything expressible via config plugins — but a native tweak that isn't (a genuinely custom native module edit) still reintroduces the old diverged-native-code problem the "reversible prebuild" framing doesn't fully solve.

**Decision**: proceed with EAS — risks above are noted and carried into the risk register below, not treated as blockers.

## Operational Story

- **Preview builds**: `eas build --profile preview` produces installable builds (internal distribution / TestFlight for iOS, direct APK or Play internal testing for Android) without a full store submission — this is the mobile equivalent of a PR preview URL.
- **Secrets**: Apple/Google signing credentials are stored in EAS's managed credential vault (or locally with `eas credentials` if self-managed); app-level env vars go through `eas secret:create` / `.env` files consumed at build time. Only the account owner (or invited team members) can read/rotate them via `eas credentials`.
- **Rollback**: For JS/asset-only changes, `eas update --branch <branch>` publishes instantly and a bad update rolls back with `eas update:republish` targeting the previous update group — no store review needed. For native-code changes (a new build), there is no instant rollback: reverting means resubmitting a prior build via `eas submit` and waiting through normal App Store/Play Store review.
- **Approval**: A human must approve the actual store submission (`eas submit` still requires Apple/Google account-level authorization) and any signing-credential rotation. An agent may run `eas build`, `eas update`, and read build/status logs unattended.
- **Logs**: `eas build:list` / `eas build:view <id>` for build history and status; `eas update:list` for OTA update history. The Expo MCP Server (free tier, fair-use limited) exposes the same data as structured tool calls instead of parsed CLI output.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Free-tier build queue (60-90+ min at peak) stalls iteration during the 1.5-week window | Devil's advocate / Pre-mortem | M | H | Batch native-config changes to minimize build count; test locally with `expo prebuild` + local simulator builds before triggering a cloud EAS build; reserve cloud builds for near-final verification. |
| Exceeding free-tier build allowance forces an unplanned $225/mo Production-tier charge | Devil's advocate / Pre-mortem | M | M | Track build count against the 15+15/month allowance; disable `auto-deploy-on-merge` CI triggering on every commit (per `tech-stack.md` hint) in favor of manual/on-demand builds during active iteration to conserve the allowance. |
| `app.json`/`package.json` still carry the `.bootstrap-scaffold`/`bootstrap-scaffold` placeholder name, which `eas init` will bind to the Expo project ID | Unknown unknowns | H | M | Rename `app.json`'s `name`/`slug` and `package.json`'s `name` to the real product identity before running `eas init` or the first `eas build`. |
| Crash reporting is not actually bundled with EAS despite the co-location preference | Devil's advocate | L | L | If crash visibility becomes a priority post-MVP, budget a separate Sentry setup explicitly rather than assuming EAS covers it. |
| EAS Update (OTA) can't cover native-code / SDK-version changes, so those still hit full store review timelines | Unknown unknowns | M | M | Treat OTA as a JS/asset-only fast path; plan any native dependency or SDK bump with normal App Store/Play review lead time in mind, not as an instant-deploy change. |
| Vendor dependency on Expo Inc. for the whole build/submit/update pipeline | Devil's advocate | L | M | `eas build --local` is a documented escape hatch; note it in project docs so it isn't discovered for the first time under deadline pressure. |

## Getting Started

1. Fix the placeholder identity first: update `app.json`'s `name`/`slug` and `package.json`'s `name` from `.bootstrap-scaffold`/`bootstrap-scaffold` to the real product name — do this before the next step, since `eas init` binds the current slug to your Expo project ID.
2. Install the CLI and log in: `npm install -g eas-cli` (or `npx eas-cli`), then `eas login`.
3. Initialize the project: `eas init` (creates the Expo project ID and links it to `app.json`).
4. Configure build profiles: `eas build:configure` to generate `eas.json` with `development` / `preview` / `production` profiles.
5. Run a first build on one platform (per the "one platform first is fine" interview answer): `eas build --platform android --profile preview` (or `--platform ios` if targeting iOS first) — verify the credential flow and build output before wiring up CI auto-builds.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration (not applicable — no backend/container to build).
- CI/CD pipeline setup beyond the platform choice itself (the actual GitHub Actions workflow wiring is a separate implementation step).
- Production-scale architecture (multi-region, HA, DR) — not applicable to a single-user, on-device MVP.
- Backend/cloud-sync infrastructure — the PRD's Open Questions leave cloud sync undecided; if it's ever added, this research would need to be redone against the web-hosting candidate pool this skill normally uses.
